-- Track whether an admin RewardVault grant has been added to profiles.total_earned_usdt.
alter table public.admin_reward_grants
  add column if not exists earned_credited boolean not null default false;

comment on column public.admin_reward_grants.earned_credited is
  'True once this grant amount has been added to profiles.total_earned_usdt';
