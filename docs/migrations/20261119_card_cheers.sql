-- Cheers (20261119): G$ sent from one player to another's Bingo card. Each
-- cheer is a vote in that week's "Best card" contest (lib/bingo/cheers.ts).
-- Recorded only after the G$ transfer is confirmed on-chain. Safe to re-run.

create table if not exists public.card_cheers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  campaign_id uuid not null,
  from_wallet text not null check (from_wallet = lower(from_wallet)),
  to_wallet text not null check (to_wallet = lower(to_wallet)),
  amount numeric(24, 8) not null check (amount > 0),
  tx_hash text not null unique,
  week_start text not null,       -- the contest week (referral round start)
  lagos_day text not null,        -- one cheer per person per card per day
  created_at timestamptz not null default now(),
  unique (attempt_id, from_wallet, lagos_day)
);
create index if not exists card_cheers_week_idx on public.card_cheers (campaign_id, week_start);
create index if not exists card_cheers_to_idx on public.card_cheers (to_wallet, created_at desc);

alter table public.card_cheers enable row level security;

notify pgrst, 'reload schema';
