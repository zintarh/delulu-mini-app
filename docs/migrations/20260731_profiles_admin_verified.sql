-- Admin-set "verified" badge for a user, distinct from GoodDollar identity
-- verification (identityHook.ts) and AI proof verification (verify-image-proof.ts) —
-- this one is a manual admin toggle on the People table.
alter table public.profiles
  add column if not exists admin_verified boolean not null default false;

comment on column public.profiles.admin_verified is
  'Set by a platform admin from the dashboard People table; unrelated to GoodDollar identity verification or proof verification';
