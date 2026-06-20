-- Phase 2: Community Campaigns
-- Run in Supabase SQL editor AFTER COMMUNITIES_SCHEMA.sql

create table if not exists community_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  community_id          uuid not null references communities(id) on delete cascade,
  proposed_by           uuid references staff_users(id),
  title                 text not null,
  description           text,
  proof_cadence         text not null default 'daily'
                        check (proof_cadence in ('daily', 'weekly')),
  proof_instructions    text,
  content_hash          text,
  proposed_pool_amount  numeric not null default 0,
  on_chain_challenge_id bigint unique,
  status                text not null default 'draft'
                        check (status in (
                          'draft', 'pending_approval', 'approved', 'funding',
                          'active', 'ended', 'rejected'
                        )),
  display_ends_at       timestamptz,
  ended_at              timestamptz,
  ended_by              uuid references staff_users(id),
  approved_by           uuid references staff_users(id),
  approved_at           timestamptz,
  rejection_reason      text,
  duration_days         integer not null default 30
                        check (duration_days > 0),
  prize_winner_count    integer not null default 10
                        check (prize_winner_count in (5, 10, 20)),
  cover_image_url       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists campaign_participants (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references community_campaigns(id) on delete cascade,
  wallet_address  text not null,
  points_total    integer not null default 0,
  current_streak  integer not null default 0,
  status          text not null default 'joined'
                  check (status in ('joined', 'withdrawn')),
  joined_at       timestamptz not null default now(),
  unique (campaign_id, wallet_address)
);

create table if not exists campaign_proof_submissions (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references community_campaigns(id) on delete cascade,
  participant_id  uuid not null references campaign_participants(id) on delete cascade,
  wallet_address  text not null,
  proof_url       text not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  points_awarded  integer not null default 0,
  ai_verdict      jsonb,
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz
);

create table if not exists campaign_status_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references community_campaigns(id) on delete cascade,
  event         text not null,
  actor_id      uuid references staff_users(id),
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_campaigns_community_status
  on community_campaigns (community_id, status, created_at desc);
create index if not exists idx_campaigns_status
  on community_campaigns (status, created_at desc);
create index if not exists idx_campaigns_on_chain
  on community_campaigns (on_chain_challenge_id);
create index if not exists idx_campaign_participants_campaign
  on campaign_participants (campaign_id, points_total desc);
create index if not exists idx_campaign_participants_wallet
  on campaign_participants (wallet_address);
create index if not exists idx_campaign_proofs_campaign
  on campaign_proof_submissions (campaign_id, submitted_at desc);
