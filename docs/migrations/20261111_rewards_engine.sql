-- Delulu G$ Rewards Engine. See apps/web/src/lib/rewards/.
--
--   daily_proof          100 G$ per approved proof, one per goal per day, at
--                        most 2 eligible goals per user at a time
--   weekly_consistency   250 G$ once per user per Mon–Sun week, after 5
--                        daily-rewarded proofs in that week
--   campaign_completion  500 / 1,000 / 5,000 G$ once per completed campaign
--                        (7 / 30 / 90+ day campaigns); late joiners get a
--                        reduced share
--   goal_completion      same tiers, once per completed Forfeit goal, scaled
--                        by how much of it ran in an earning slot
--
-- Amounts and limits live in reward_config (overrides the code defaults in
-- lib/rewards/rules.ts). G$ is credited from the RewardVault pool; the user
-- claims it with the existing claim flow.
--
-- proof_rewards stays the log of *verified* proofs (AI/friend approval +
-- matching on-chain proof tx). Its status / amount / deposit columns belong
-- to the retired 10 G$ per-proof reward and are only read for those old rows.
-- Safe to run more than once, and on its own: it creates proof_rewards too
-- if 20260924_proof_rewards.sql was never applied (same columns), so the two
-- can't be run in the wrong order.

-- ── Verified-proof log (from 20260924_proof_rewards.sql) ────────────────────
create table if not exists public.proof_rewards (
  id               uuid        primary key default gen_random_uuid(),
  wallet           text        not null,
  kind             text        not null check (kind in ('campaign', 'forfeit')),
  proof_url        text        not null,
  ref_id           text,
  status           text        not null default 'approved'
                     check (status in ('approved', 'paying', 'sent', 'capped', 'failed')),
  proof_tx_hash    text        unique,
  reward_day       date,
  amount           integer     not null default 10,
  reward_id        text,
  deposit_tx_hash  text,
  created_at       timestamptz not null default now(),
  paid_at          timestamptz,
  unique (wallet, proof_url)
);

create index if not exists proof_rewards_wallet_day_idx
  on public.proof_rewards (wallet, reward_day);

alter table public.proof_rewards enable row level security;

-- ── Config ──────────────────────────────────────────────────────────────────
create table if not exists public.reward_config (
  id          text        primary key default 'default' check (id = 'default'),
  config      jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.reward_config (id, config) values ('default', '{}'::jsonb)
on conflict (id) do nothing;

comment on table public.reward_config is
  'Single row. Partial JSON override of DEFAULT_REWARDS_CONFIG (lib/rewards/rules.ts), e.g. {"dailyProof":{"amount":150},"campaignCompletion":{"tiers":[{"minDays":7,"amount":500}]}}. Invalid fields fall back to defaults. {"enabled":false} pauses all new rewards.';

alter table public.reward_config enable row level security;

-- ── Verified proofs ─────────────────────────────────────────────────────────
alter table public.proof_rewards
  add column if not exists verified_at timestamptz;

comment on column public.proof_rewards.verified_at is
  'When this approved proof was matched to its on-chain proof tx (proof_tx_hash) — only verified proofs can earn rewards.';

-- ── Eligible-goal slots ─────────────────────────────────────────────────────
-- A goal takes one of the user's slots on its first rewarded proof and holds
-- it until it ends. Completing frees it at once; abandoning (cancel, forfeit,
-- leave, or going idle) keeps it blocked until cooldown_until. A goal never
-- gets a second slot, so leaving and rejoining the same campaign earns nothing.
create table if not exists public.reward_goal_slots (
  id               uuid        primary key default gen_random_uuid(),
  wallet           text        not null,
  goal_kind        text        not null check (goal_kind in ('campaign', 'forfeit')),
  goal_ref         text        not null,
  claimed_day      date        not null,
  last_active_day  date        not null,
  released_at      timestamptz,
  -- Reward-calendar day of the release: proofs dated on or before it (late
  -- retries) still earn; later ones don't.
  released_day     date,
  release_reason   text        check (release_reason in ('completed', 'abandoned', 'idle')),
  cooldown_until   date,
  created_at       timestamptz not null default now(),
  unique (wallet, goal_kind, goal_ref)
);

create index if not exists reward_goal_slots_wallet_idx
  on public.reward_goal_slots (wallet);

alter table public.reward_goal_slots enable row level security;

-- ── Reward ledger ───────────────────────────────────────────────────────────
-- One row per reward ever granted, any category. dedupe_key makes every grant
-- idempotent (retried requests hit the unique index); reward_id is the
-- on-chain RewardVault id derived from it, so the vault rejects a second
-- credit even if this table were lost.
--
-- status: pending     reserved, not sent yet
--         processing  a worker holds it and is about to broadcast
--         submitted   tx broadcast, tx_hash saved, awaiting confirmation
--         confirmed   tx mined successfully — the only "paid" state
--         failed      errored or reverted; retried by the payout cron
create table if not exists public.reward_payouts (
  id               uuid        primary key default gen_random_uuid(),
  wallet           text        not null,
  category         text        not null
                     constraint reward_payouts_category_check
                     check (category in ('daily_proof', 'weekly_consistency', 'campaign_completion', 'goal_completion')),
  amount           numeric     not null check (amount > 0),
  token            text        not null default 'G$',
  dedupe_key       text        not null unique,
  reward_id        text        not null unique,
  goal_kind        text        check (goal_kind in ('campaign', 'forfeit')),
  goal_ref         text,
  period_key       text,
  reward_day       date        not null,
  source_proof_id  uuid        references public.proof_rewards (id) on delete set null,
  status           text        not null default 'pending'
                     check (status in ('pending', 'processing', 'submitted', 'confirmed', 'failed')),
  tx_hash          text        unique,
  attempts         integer     not null default 0,
  last_error       text,
  locked_at        timestamptz,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  confirmed_at     timestamptz
);

-- Keeps re-runs in step with the category list above.
alter table public.reward_payouts drop constraint if exists reward_payouts_category_check;
alter table public.reward_payouts add constraint reward_payouts_category_check
  check (category in ('daily_proof', 'weekly_consistency', 'campaign_completion', 'goal_completion'));

create index if not exists reward_payouts_wallet_category_day_idx
  on public.reward_payouts (wallet, category, reward_day);

create index if not exists reward_payouts_open_idx
  on public.reward_payouts (status, updated_at)
  where status <> 'confirmed';

alter table public.reward_payouts enable row level security;

create or replace function public.reward_payouts_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reward_payouts_touch on public.reward_payouts;
create trigger reward_payouts_touch before update on public.reward_payouts
  for each row execute function public.reward_payouts_touch();

-- ── Daily proof reservation ─────────────────────────────────────────────────
-- Atomically decides whether one verified proof earns its goal's daily
-- reward, and if so records it as 'pending'. A per-wallet advisory lock
-- serializes concurrent proofs, so two landing at once can't both take the
-- last slot. Outcomes:
--   reserved       new pending reward created (payout_id)
--   exists         this goal already has its reward for that day (payout_id)
--   goal_released  this goal gave up its slot before p_day
--   daily_limit    the user already earned p_max_goals daily rewards that day
--   goal_limit     every slot is held or cooling down
create or replace function public.reserve_daily_proof_reward(
  p_wallet          text,
  p_goal_kind       text,
  p_goal_ref        text,
  p_day             date,
  p_amount          numeric,
  p_max_goals       integer,
  p_dedupe_key      text,
  p_reward_id       text,
  p_source_proof_id uuid
) returns jsonb
language plpgsql
as $$
declare
  existing   public.reward_payouts%rowtype;
  slot       public.reward_goal_slots%rowtype;
  used_today integer;
  held       integer;
  new_id     uuid;
begin
  perform pg_advisory_xact_lock(hashtext('rewards:' || p_wallet));

  select * into existing from public.reward_payouts where dedupe_key = p_dedupe_key;
  if found then
    return jsonb_build_object('outcome', 'exists', 'payout_id', existing.id, 'status', existing.status);
  end if;

  select * into slot from public.reward_goal_slots
   where wallet = p_wallet and goal_kind = p_goal_kind and goal_ref = p_goal_ref
   for update;
  if found and slot.released_at is not null and p_day > coalesce(slot.released_day, p_day - 1) then
    return jsonb_build_object('outcome', 'goal_released');
  end if;

  select count(*) into used_today from public.reward_payouts
   where wallet = p_wallet and category = 'daily_proof' and reward_day = p_day;
  if used_today >= p_max_goals then
    return jsonb_build_object('outcome', 'daily_limit');
  end if;

  if slot.id is null then
    -- New goal: needs a free slot (held and cooling-down slots both count).
    select count(*) into held from public.reward_goal_slots
     where wallet = p_wallet
       and (released_at is null or cooldown_until > p_day);
    if held >= p_max_goals then
      return jsonb_build_object('outcome', 'goal_limit');
    end if;
    insert into public.reward_goal_slots (wallet, goal_kind, goal_ref, claimed_day, last_active_day)
    values (p_wallet, p_goal_kind, p_goal_ref, p_day, p_day);
  elsif slot.released_at is null then
    update public.reward_goal_slots
       set last_active_day = greatest(last_active_day, p_day)
     where id = slot.id;
  end if;

  insert into public.reward_payouts
    (wallet, category, amount, dedupe_key, reward_id, goal_kind, goal_ref, period_key, reward_day, source_proof_id)
  values
    (p_wallet, 'daily_proof', p_amount, p_dedupe_key, p_reward_id, p_goal_kind, p_goal_ref, p_day::text, p_day, p_source_proof_id)
  returning id into new_id;

  return jsonb_build_object('outcome', 'reserved', 'payout_id', new_id, 'status', 'pending');
end;
$$;

-- ── Payout lease ────────────────────────────────────────────────────────────
-- Hands a reward to exactly one worker for sending. A 'processing' lease
-- older than p_stale_seconds is assumed crashed and can be taken over (the
-- on-chain usedRewardId check makes that safe). Returns the row, or nothing
-- if it isn't sendable right now.
create or replace function public.claim_reward_payout(
  p_id            uuid,
  p_stale_seconds integer default 300
) returns setof public.reward_payouts
language sql
as $$
  update public.reward_payouts
     set status = 'processing',
         locked_at = now(),
         attempts = attempts + 1
   where id = p_id
     and (
       status in ('pending', 'failed')
       or (status = 'processing' and locked_at < now() - make_interval(secs => p_stale_seconds))
     )
  returning *;
$$;

revoke all on function public.reserve_daily_proof_reward(text, text, text, date, numeric, integer, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_reward_payout(uuid, integer) from public, anon, authenticated;

-- ── Admin management ────────────────────────────────────────────────────────
-- Settings are edited from /dashboard/reward-engine/settings (platform admins
-- only). Every change and every manual action lands in reward_admin_audit.

alter table public.reward_config
  add column if not exists updated_by text;

create table if not exists public.reward_admin_audit (
  id           uuid        primary key default gen_random_uuid(),
  action       text        not null check (action in ('config_update', 'payout_retry')),
  actor_id     text,
  actor_email  text        not null,
  reason       text        not null,
  -- config_update: { changes: [{path, before, after}], before, after }
  -- payout_retry:  { payoutId, wallet, category, amount, statusBefore, statusAfter }
  details      jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists reward_admin_audit_created_idx
  on public.reward_admin_audit (created_at desc);

alter table public.reward_admin_audit enable row level security;

-- G$ the engine has put on-chain (submitted or confirmed) since p_since —
-- what the platform daily budget (reward_config limits.dailyBudget) counts.
create or replace function public.reward_engine_sent_since(p_since timestamptz)
returns numeric
language sql stable
as $$
  select coalesce(sum(amount), 0)
    from public.reward_payouts
   where status in ('submitted', 'confirmed')
     and submitted_at >= p_since;
$$;

-- Distribution stats for the admin overview, in one round trip.
create or replace function public.reward_engine_stats()
returns jsonb
language sql stable
as $$
  with p as (select * from public.reward_payouts),
  cats as (
    select category,
           coalesce(sum(amount) filter (where status = 'confirmed'), 0)                                   as confirmed,
           count(*) filter (where status = 'confirmed')                                                    as confirmed_count,
           coalesce(sum(amount) filter (where status in ('pending', 'processing', 'submitted')), 0)        as pending,
           coalesce(sum(amount) filter (where status = 'failed'), 0)                                       as failed
      from p group by category
  )
  select jsonb_build_object(
    'confirmed_total', coalesce((select sum(amount) from p where status = 'confirmed'), 0),
    'confirmed_count', (select count(*) from p where status = 'confirmed'),
    'recipients',      (select count(distinct wallet) from p where status = 'confirmed'),
    'confirmed_24h',   coalesce((select sum(amount) from p where status = 'confirmed' and confirmed_at >= now() - interval '24 hours'), 0),
    'confirmed_7d',    coalesce((select sum(amount) from p where status = 'confirmed' and confirmed_at >= now() - interval '7 days'), 0),
    'confirmed_30d',   coalesce((select sum(amount) from p where status = 'confirmed' and confirmed_at >= now() - interval '30 days'), 0),
    'pending_total',   coalesce((select sum(amount) from p where status in ('pending', 'processing', 'submitted')), 0),
    'pending_count',   (select count(*) from p where status in ('pending', 'processing', 'submitted')),
    'failed_total',    coalesce((select sum(amount) from p where status = 'failed'), 0),
    'failed_count',    (select count(*) from p where status = 'failed'),
    'oldest_open_at',  (select min(created_at) from p where status <> 'confirmed'),
    'sent_today_utc',  public.reward_engine_sent_since(date_trunc('day', now() at time zone 'utc') at time zone 'utc'),
    'legacy_sent_total', coalesce((select sum(amount) from public.proof_rewards where status = 'sent'), 0),
    'by_category',     coalesce((select jsonb_object_agg(category, jsonb_build_object(
                          'confirmed', confirmed, 'confirmed_count', confirmed_count,
                          'pending', pending, 'failed', failed)) from cats), '{}'::jsonb)
  );
$$;

revoke all on function public.reward_engine_sent_since(timestamptz) from public, anon, authenticated;
revoke all on function public.reward_engine_stats() from public, anon, authenticated;

-- Saves new settings and their audit entry in one transaction, so a change
-- can never land without its log. Optimistic: p_expected_updated_at must
-- match the row (null = the row was never saved through the dashboard), or
-- nothing changes and 'conflict' comes back — two admins editing at once
-- can't silently overwrite each other.
create or replace function public.update_reward_config(
  p_config              jsonb,
  p_expected_updated_at timestamptz,
  p_actor_id            text,
  p_actor_email         text,
  p_reason              text,
  p_details             jsonb
) returns jsonb
language plpgsql
as $$
declare
  current_row public.reward_config%rowtype;
  new_updated timestamptz;
begin
  select * into current_row from public.reward_config where id = 'default' for update;
  if not found then
    insert into public.reward_config (id, config) values ('default', '{}'::jsonb)
    returning * into current_row;
  end if;

  if current_row.updated_by is null and p_expected_updated_at is null then
    null; -- first dashboard save over the seeded row
  elsif p_expected_updated_at is null or current_row.updated_at <> p_expected_updated_at then
    return jsonb_build_object('outcome', 'conflict', 'updated_at', current_row.updated_at, 'updated_by', current_row.updated_by);
  end if;

  update public.reward_config
     set config = p_config, updated_at = now(), updated_by = p_actor_email
   where id = 'default'
  returning updated_at into new_updated;

  insert into public.reward_admin_audit (action, actor_id, actor_email, reason, details)
  values ('config_update', p_actor_id, p_actor_email, p_reason, p_details);

  return jsonb_build_object('outcome', 'saved', 'updated_at', new_updated);
end;
$$;

revoke all on function public.update_reward_config(jsonb, timestamptz, text, text, text, jsonb)
  from public, anon, authenticated;
