-- Referral spots per round (20261118): the admin sets how many friends each
-- 2-week round can credit (Dashboard → Referrals → Referral spots). Rounds
-- without a row use the default in lib/referral/campaign.ts. Safe to re-run.

create table if not exists public.referral_round_slots (
  round_start text primary key,           -- REFERRAL_ROUNDS[].start, e.g. 2026-11-18T00:00:00+01:00
  slots int not null check (slots >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.referral_round_slots enable row level security;

notify pgrst, 'reload schema';

-- Season targets per 2-week epoch (Dashboard → Season). Defaults live in
-- lib/referral/campaign.ts; a row here overrides them.
create table if not exists public.season_epoch_targets (
  epoch int primary key check (epoch between 1 and 12),
  circulation_target bigint not null check (circulation_target >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.season_epoch_targets enable row level security;

notify pgrst, 'reload schema';
