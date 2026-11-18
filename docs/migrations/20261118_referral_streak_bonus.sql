-- Referral pay in two parts (20261118): the first payment when the friend
-- qualifies (payout_status / gdollars_amount, unchanged), and a bonus once the
-- friend has shown up 3 days in a row (lib/referral/streak.ts). Safe to re-run.

alter table public.referral_credits add column if not exists streak_status text
  check (streak_status in ('processing', 'sent', 'failed', 'not_eligible'));
alter table public.referral_credits add column if not exists streak_amount numeric(24, 8);
alter table public.referral_credits add column if not exists streak_tx_hash text;
alter table public.referral_credits add column if not exists streak_paid_at timestamptz;

create index if not exists referral_credits_streak_pending_idx
  on public.referral_credits (credited_at)
  where payout_status = 'sent' and (streak_status is null or streak_status <> 'sent');

notify pgrst, 'reload schema';
