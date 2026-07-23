-- Lifetime G$ claimed via the app (GoodDollar daily UBI claims).
-- Used for leaderboard / wallet "Earned" alongside on-chain delulu reward claims.
alter table public.profiles
  add column if not exists total_claimed_gd numeric(24, 8) not null default 0;

comment on column public.profiles.total_claimed_gd is
  'Sum of G$ amounts claimed through the Delulu app (UBI), in human units';
