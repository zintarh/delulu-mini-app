-- One-time onboarding gift: 1000 G$ via RewardVault for any wallet that is
-- both GoodDollar-verified AND has finished account setup (onboarded_at) —
-- seed funding they can use to join a paid campaign, granted before any
-- campaign join rather than as a reward for one. Granted automatically the
-- moment both conditions are first true (see
-- apps/web/src/lib/onboarding/gift.ts); the user must claim it from the
-- vault themselves (existing claim flow) before the blocking claim modal
-- stops showing.

alter table public.profiles
  add column if not exists onboarding_gift_status text not null default 'not_eligible'
    check (onboarding_gift_status in ('not_eligible', 'sent', 'failed')),
  add column if not exists onboarding_gift_reward_id text,
  add column if not exists onboarding_gift_tx_hash text,
  add column if not exists onboarding_gift_paid_at timestamptz,
  add column if not exists onboarding_gift_claimed_at timestamptz;

create index if not exists profiles_onboarding_gift_status_idx
  on public.profiles (onboarding_gift_status)
  where onboarding_gift_status = 'failed';

comment on column public.profiles.onboarding_gift_status is
  'not_eligible: not yet both GoodDollar-verified and joined a campaign. sent: 1000 G$ deposited into RewardVault, claimable. failed: on-chain deposit attempt errored.';
