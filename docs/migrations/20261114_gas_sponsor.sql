-- Gas sponsorship for users who skip the face check (apps/web/src/lib/faucet).
--
-- Replaces the flat 0.3 CELO once-per-wallet faucet with small, live-priced
-- drips tied to progress: signup (profile tx) → starter (profile exists
-- on-chain) → active (recent approved proofs). Every limit is checked and the
-- claim row inserted inside faucet_reserve() under one advisory lock, so
-- concurrent requests can't slip past a cap.
--
-- status: pending    reserved, nothing broadcast yet
--         submitted  tx broadcast, tx_hash saved, awaiting receipt
--         sent       receipt confirmed
--         failed     send errored, reverted or was dropped (reservation released)
--         rejected   refused (reason in agent_reasoning) — kept for abuse analytics
--
-- Safe to run more than once.

-- ── Claims ──────────────────────────────────────────────────────────────────
alter table public.gas_faucet_claims
  add column if not exists stage               text,
  add column if not exists ip_subnet           text,
  add column if not exists gas_price_gwei      numeric,
  add column if not exists balance_before_celo numeric,
  add column if not exists updated_at          timestamptz not null default now(),
  add column if not exists submitted_at        timestamptz,
  add column if not exists confirmed_at        timestamptz;

-- Drips are fractions of a cent; 4 decimals would round them away.
alter table public.gas_faucet_claims alter column amount_celo type numeric(20, 8);

-- Old flat claims count against the signup step, so they can't take it again.
update public.gas_faucet_claims set stage = 'legacy' where stage is null;

alter table public.gas_faucet_claims drop constraint if exists gas_faucet_claims_status_check;
alter table public.gas_faucet_claims add constraint gas_faucet_claims_status_check
  check (status in ('pending', 'submitted', 'sent', 'failed', 'rejected'));

alter table public.gas_faucet_claims drop constraint if exists gas_faucet_claims_stage_check;
alter table public.gas_faucet_claims add constraint gas_faucet_claims_stage_check
  check (stage in ('legacy', 'signup', 'starter', 'active'));

-- A wallet now gets several small drips, so "one sent row per wallet/email" goes.
drop index if exists public.gas_faucet_claims_address_sent;
drop index if exists public.gas_faucet_claims_email_sent;

-- The old faucet left a pending row whenever a request errored, so a wallet
-- can have several. Settle them first or the unique index below can't build.
update public.gas_faucet_claims
set status = 'failed', agent_reasoning = coalesce(agent_reasoning, 'stale_pending')
where status = 'pending' and created_at < now() - interval '10 minutes';

-- One drip in flight per wallet — the hard backstop against double sends.
create unique index if not exists gas_faucet_claims_in_flight
  on public.gas_faucet_claims (address)
  where status in ('pending', 'submitted');

create index if not exists gas_faucet_claims_stage_idx
  on public.gas_faucet_claims (address, stage, status);

create index if not exists gas_faucet_claims_subnet_created
  on public.gas_faucet_claims (ip_subnet, created_at)
  where ip_subnet is not null;

create index if not exists gas_faucet_claims_status_created
  on public.gas_faucet_claims (status, created_at);

create or replace function public.gas_faucet_claims_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists gas_faucet_claims_touch on public.gas_faucet_claims;
create trigger gas_faucet_claims_touch before update on public.gas_faucet_claims
  for each row execute function public.gas_faucet_claims_touch();

alter table public.gas_faucet_claims enable row level security;

-- ── Config ──────────────────────────────────────────────────────────────────
create table if not exists public.faucet_config (
  id          text        primary key default 'default' check (id = 'default'),
  config      jsonb       not null default '{}'::jsonb,
  reason      text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

insert into public.faucet_config (id, config) values ('default', '{}'::jsonb)
on conflict (id) do nothing;

comment on table public.faucet_config is
  'Single row. Partial JSON override of DEFAULT_FAUCET_CONFIG (lib/faucet/rules.ts). Invalid fields fall back to defaults. {"enabled":false} pauses all drips.';

alter table public.faucet_config enable row level security;

-- ── Blocklist ───────────────────────────────────────────────────────────────
create table if not exists public.faucet_blocklist (
  id          uuid        primary key default gen_random_uuid(),
  kind        text        not null check (kind in ('address', 'ip', 'subnet')),
  value       text        not null,
  reason      text,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (kind, value)
);

alter table public.faucet_blocklist enable row level security;

-- ── Reservation ─────────────────────────────────────────────────────────────
-- Checks every limit and inserts the pending claim atomically. Amounts are
-- CELO. p_window_hours null = lifetime (signup, starter).
create or replace function public.faucet_reserve(
  p_address        text,
  p_stage          text,
  p_amount         numeric,
  p_ip             text,
  p_subnet         text,
  p_stage_cap      numeric,
  p_window_hours   integer,
  p_ip_limit       integer,
  p_subnet_limit   integer,
  p_daily_budget   numeric,
  p_gas_price_gwei numeric,
  p_balance_before numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used    numeric;
  v_wallets integer;
  v_daily   numeric;
  v_id      uuid;
begin
  perform pg_advisory_xact_lock(hashtext('gas_faucet_reserve'));

  if exists (
    select 1 from gas_faucet_claims
    where address = p_address and status in ('pending', 'submitted')
  ) then
    return jsonb_build_object('outcome', 'in_flight');
  end if;

  select coalesce(sum(amount_celo), 0) into v_used
  from gas_faucet_claims
  where address = p_address
    and status in ('pending', 'submitted', 'sent')
    and (stage = p_stage or (p_stage = 'signup' and stage = 'legacy'))
    and (p_window_hours is null or created_at > now() - make_interval(hours => p_window_hours));
  if v_used + p_amount > p_stage_cap then
    return jsonb_build_object('outcome', 'stage_cap', 'used', v_used);
  end if;

  if p_stage = 'signup' then
    if p_ip is not null and p_ip_limit > 0 then
      select count(distinct address) into v_wallets
      from gas_faucet_claims
      where ip_address = p_ip
        and stage in ('signup', 'legacy')
        and status in ('pending', 'submitted', 'sent')
        and created_at > now() - interval '24 hours'
        and address <> p_address;
      if v_wallets >= p_ip_limit then
        return jsonb_build_object('outcome', 'ip_limit');
      end if;
    end if;
    if p_subnet is not null and p_subnet_limit > 0 then
      select count(distinct address) into v_wallets
      from gas_faucet_claims
      where ip_subnet = p_subnet
        and stage = 'signup'
        and status in ('pending', 'submitted', 'sent')
        and created_at > now() - interval '24 hours'
        and address <> p_address;
      if v_wallets >= p_subnet_limit then
        return jsonb_build_object('outcome', 'subnet_limit');
      end if;
    end if;
  end if;

  select coalesce(sum(amount_celo), 0) into v_daily
  from gas_faucet_claims
  where status in ('pending', 'submitted', 'sent')
    and created_at > now() - interval '24 hours';
  if v_daily + p_amount > p_daily_budget then
    return jsonb_build_object('outcome', 'daily_budget');
  end if;

  insert into gas_faucet_claims
    (address, stage, amount_celo, ip_address, ip_subnet, status, gas_price_gwei, balance_before_celo)
  values
    (p_address, p_stage, p_amount, p_ip, p_subnet, 'pending', p_gas_price_gwei, p_balance_before)
  returning id into v_id;

  return jsonb_build_object('outcome', 'reserved', 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('outcome', 'in_flight');
end $$;

revoke all on function public.faucet_reserve(text, text, numeric, text, text, numeric, integer, integer, integer, numeric, numeric, numeric) from public, anon, authenticated;
