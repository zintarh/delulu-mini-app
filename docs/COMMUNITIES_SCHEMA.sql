-- Phase 1: Community Platform Foundation
-- Run this in Supabase SQL editor AFTER ALL_TABLES.sql has been applied.

-- Staff users linked to Supabase Auth (platform admins + community sub-admins)
create table if not exists staff_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  display_name  text,
  global_role   text not null default 'community_admin'
                check (global_role in ('platform_admin', 'community_admin')),
  created_at    timestamptz not null default now()
);

-- Communities
create table if not exists communities (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  description         text,
  member_invite_code  text not null unique,
  status              text not null default 'active'
                      check (status in ('active', 'archived')),
  created_by          uuid references staff_users(id),
  created_at          timestamptz not null default now()
);

-- Many-to-many: which staff users admin which communities
create table if not exists community_admin_assignments (
  community_id    uuid not null references communities(id) on delete cascade,
  staff_user_id   uuid not null references staff_users(id) on delete cascade,
  status          text not null default 'active'
                  check (status in ('pending', 'active', 'revoked')),
  invited_by      uuid references staff_users(id),
  created_at      timestamptz not null default now(),
  primary key (community_id, staff_user_id)
);

-- Pending staff invitations (sub-admin + platform_admin onboarding)
create table if not exists staff_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  community_id  uuid references communities(id),  -- null = platform_admin invite
  role          text not null
                check (role in ('platform_admin', 'community_admin')),
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  invited_by    uuid references staff_users(id),
  created_at    timestamptz not null default now()
);

-- Wallet users who have joined a community via invite code
create table if not exists community_members (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references communities(id) on delete cascade,
  wallet_address  text not null,
  status          text not null default 'active'
                  check (status in ('active', 'banned')),
  joined_via      text,  -- 'invite_code' | 'admin_added'
  last_seen_at    timestamptz,
  joined_at       timestamptz not null default now(),
  unique (community_id, wallet_address)
);

-- Indexes
create index if not exists idx_communities_status            on communities (status);
create index if not exists idx_community_admin_community     on community_admin_assignments (community_id, status);
create index if not exists idx_community_admin_staff         on community_admin_assignments (staff_user_id, status);
create index if not exists idx_staff_invites_token           on staff_invites (token_hash);
create index if not exists idx_staff_invites_email           on staff_invites (email);
create index if not exists idx_community_members_community   on community_members (community_id, status);
create index if not exists idx_community_members_wallet      on community_members (wallet_address);

-- Seed: promote the default platform admin in staff_users.
-- Run after creating the Supabase Auth user (or the accept-invite flow does it automatically).
-- Replace the UUID with the actual auth.users.id for kateberryd@gmail.com.
-- INSERT INTO staff_users (id, email, display_name, global_role)
-- VALUES ('<auth-user-uuid>', 'kateberryd@gmail.com', 'Platform Admin', 'platform_admin')
-- ON CONFLICT (id) DO UPDATE SET global_role = 'platform_admin';
