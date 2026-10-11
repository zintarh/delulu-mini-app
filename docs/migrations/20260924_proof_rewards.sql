-- Proof rewards: 10 G$ via RewardVault for every approved proof, capped at 5
-- paid proofs per wallet per day (Africa/Lagos calendar day). The user claims
-- it from the vault themselves (existing claim flow), right from the proof
-- success card. See apps/web/src/lib/proof-reward/grant.ts.
--
-- A row is created the moment a proof is approved off-chain (AI pass in
-- /api/community/campaigns/[id]/proof or /api/forfeit/submit-proof), keyed by
-- (wallet, proof_url). The grant step only pays once an on-chain proof tx
-- carrying that exact proof_url is found for that wallet — so calling the
-- contract directly with an unreviewed proof never earns anything.
-- Friend-verified forfeit proofs get their row at grant time instead, gated
-- on the friend's on-chain approval (forfeit_periods.verifier_action).

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

create index if not exists proof_rewards_failed_idx
  on public.proof_rewards (status)
  where status = 'failed';

comment on table public.proof_rewards is
  'approved: proof passed review, not yet matched to an on-chain tx. paying: daily slot reserved, deposit in flight. sent: 10 G$ deposited into RewardVault, claimable. capped: over the 5-per-day limit. failed: deposit errored (re-grant retries it; rewardId is idempotent on-chain).';

alter table public.proof_rewards enable row level security;

-- Atomically reserve one of the wallet's daily paid-proof slots. A per-wallet
-- advisory lock serializes concurrent grants, so two proofs landing at once
-- can't both squeeze past the cap. Returns the row's new status.
create or replace function public.reserve_proof_reward_slot(
  p_id uuid,
  p_wallet text,
  p_day date,
  p_tx_hash text,
  p_cap integer
) returns text
language plpgsql
as $$
declare
  used integer;
  current_status text;
begin
  perform pg_advisory_xact_lock(hashtext('proof_rewards:' || p_wallet));

  select status into current_status from public.proof_rewards where id = p_id for update;
  if current_status is null then
    return 'missing';
  end if;
  -- Already reserved/paid/capped by an earlier call: report as-is. 'failed'
  -- keeps its slot (it was reserved before the deposit errored) and retries.
  if current_status in ('paying', 'sent', 'capped', 'failed') then
    return current_status;
  end if;

  select count(*) into used
  from public.proof_rewards
  where wallet = p_wallet
    and reward_day = p_day
    and status in ('paying', 'sent', 'failed');

  update public.proof_rewards
     set reward_day = p_day,
         proof_tx_hash = p_tx_hash,
         status = case when used >= p_cap then 'capped' else 'paying' end
   where id = p_id;

  return case when used >= p_cap then 'capped' else 'paying' end;
end;
$$;

revoke all on function public.reserve_proof_reward_slot(uuid, text, date, text, integer) from public, anon, authenticated;
