-- Referral rewards go on-chain: 6,000 G$ per counted referral, paid via
-- RewardVault (existing contract — see apps/contracts/contracts/RewardVault.sol)
-- once a wallet has 5 counted referrals. At that point referrals #1-5 are
-- paid retroactively as a lump sum (one depositReward call each, so each
-- stays individually idempotent/auditable); every referral after that pays
-- individually as it happens. Users claim their G$ themselves from the vault
-- (existing /rewards claim flow) — this migration only tracks payout state,
-- it does not move funds.

alter table public.referral_credits
  add column if not exists reward_vault_reward_id text,
  add column if not exists gdollars_amount numeric,
  add column if not exists payout_status text not null default 'not_eligible'
    check (payout_status in ('not_eligible', 'sent', 'failed')),
  add column if not exists payout_tx_hash text,
  add column if not exists paid_at timestamptz;

create index if not exists referral_credits_payout_status_idx
  on public.referral_credits (payout_status)
  where payout_status = 'failed';

comment on column public.referral_credits.payout_status is
  'not_eligible: referrer has not yet reached 5 counted referrals. sent: 6,000 G$ deposited into RewardVault for this referral, claimable by referrer. failed: on-chain deposit attempt errored, retried by the referral-payout-retry cron.';

-- Read-optimized aggregate for the leaderboard route — now surfaces G$ paid
-- alongside the historical points figure (kept for now, no longer awarded).
-- gdollars_amount must be appended AFTER last_referral_at: CREATE OR REPLACE
-- VIEW can only add columns at the end, not insert them before existing ones
-- (Postgres error 42P16 otherwise, since it would shift last_referral_at's
-- ordinal position).
create or replace view public.referral_leaderboard_v as
  select referrer_wallet                        as wallet_address,
         count(*)::int                          as referral_count,
         sum(points_awarded)::int               as points,
         max(credited_at)                       as last_referral_at,
         coalesce(sum(gdollars_amount), 0)::int as gdollars_amount
  from public.referral_credits
  group by referrer_wallet;
