-- Community member claim tracking + onboarding joined_via
-- Run in Supabase SQL editor after COMMUNITIES_SCHEMA.sql

alter table community_members
  add column if not exists gd_first_claimed_at timestamptz,
  add column if not exists gd_claim_count int not null default 0;

comment on column community_members.joined_via is 'invite_code | onboarding | admin_added';
comment on column community_members.gd_first_claimed_at is 'First Good Dollar UBI claim while member';
comment on column community_members.gd_claim_count is 'Lifetime G$ daily claims logged for this membership';

create table if not exists community_member_daily_claims (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references communities(id) on delete cascade,
  wallet_address  text not null,
  claim_date      date not null,
  claim_count     int not null default 1,
  unique (community_id, wallet_address, claim_date)
);

create index if not exists idx_cm_daily_claims_community_date
  on community_member_daily_claims (community_id, claim_date);

create index if not exists idx_cm_daily_claims_wallet_date
  on community_member_daily_claims (wallet_address, claim_date);

-- Backfill: members with profile claim history count as claimed (approximation)
update community_members cm
set
  gd_first_claimed_at = coalesce(cm.gd_first_claimed_at, now()),
  gd_claim_count = greatest(cm.gd_claim_count, coalesce(p.claim_count, 0))
from profiles p
where lower(p.address) = lower(cm.wallet_address)
  and coalesce(p.claim_count, 0) > 0
  and cm.gd_first_claimed_at is null;

-- Atomic daily claim increment (used by logCommunityMemberDailyClaim)
create or replace function public.increment_community_daily_claim(
  p_community_id uuid,
  p_wallet text,
  p_claim_date date
) returns void
language plpgsql
as $$
begin
  insert into community_member_daily_claims (community_id, wallet_address, claim_date, claim_count)
  values (p_community_id, lower(p_wallet), p_claim_date, 1)
  on conflict (community_id, wallet_address, claim_date)
  do update set claim_count = community_member_daily_claims.claim_count + 1;

  update community_members
  set
    gd_claim_count = coalesce(gd_claim_count, 0) + 1,
    gd_first_claimed_at = coalesce(gd_first_claimed_at, now())
  where community_id = p_community_id
    and wallet_address = lower(p_wallet)
    and status = 'active';
end;
$$;
