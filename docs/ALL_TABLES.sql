-- ============================================================
-- Delulu — complete Supabase schema
-- Run once in Supabase SQL editor (all statements are idempotent)
-- ============================================================


-- ── profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  address       text primary key,
  username      text,
  email         text not null unique,
  pfp_url       text,
  referral_code text,
  auth_provider text not null default 'privy',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- add auth_provider to existing installs that ran the old migration
alter table public.profiles
  add column if not exists auth_provider text not null default 'privy';


-- ── delulu_metadata ─────────────────────────────────────────
create table if not exists public.delulu_metadata (
  on_chain_id          text primary key,
  creator_address      text not null,
  title_override       text,
  description_override text,
  image_override       text,
  is_hidden            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists delulu_metadata_creator_idx
  on public.delulu_metadata (creator_address);


-- ── goal_series ──────────────────────────────────────────────
create table if not exists public.goal_series (
  id              uuid primary key default gen_random_uuid(),
  creator_address text not null,
  ultimate_goal   text not null,
  ai_side_effects jsonb,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists goal_series_creator_idx
  on public.goal_series (creator_address);

create index if not exists goal_series_status_idx
  on public.goal_series (status);


-- ── goal_series_habits ───────────────────────────────────────
create table if not exists public.goal_series_habits (
  id               uuid primary key default gen_random_uuid(),
  goal_series_id   uuid not null references public.goal_series (id) on delete cascade,
  habit_id         text not null,
  title            text not null,
  description      text,
  priority         text,
  category         text not null default 'other',
  suggested_days   integer not null default 60,
  already_has      boolean not null default false,
  status           text not null default 'pending',
  sort_order       integer not null default 0,
  emoji            text not null default '🎯',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists goal_series_habits_series_idx
  on public.goal_series_habits (goal_series_id);


-- ── faucet_claims ────────────────────────────────────────────
create table if not exists public.faucet_claims (
  id         uuid primary key default gen_random_uuid(),
  address    text not null,
  amount     numeric not null,
  tx_hash    text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists faucet_claims_address_idx
  on public.faucet_claims (address);

create index if not exists faucet_claims_created_at_idx
  on public.faucet_claims (created_at desc);


-- ── push_subscriptions ───────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  address     text not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists push_subscriptions_address_idx
  on public.push_subscriptions (address);

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (disabled_at)
  where disabled_at is null;


-- ── push_events_sent ────────────────────────────────────────
create table if not exists public.push_events_sent (
  event_key text primary key,
  address   text,
  sent_at   timestamptz not null default now()
);

create index if not exists push_events_sent_address_idx
  on public.push_events_sent (address);


-- ── updated_at trigger (shared) ─────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists delulu_metadata_set_updated_at on public.delulu_metadata;
create trigger delulu_metadata_set_updated_at
  before update on public.delulu_metadata
  for each row execute function public.set_updated_at();

drop trigger if exists goal_series_set_updated_at on public.goal_series;
create trigger goal_series_set_updated_at
  before update on public.goal_series
  for each row execute function public.set_updated_at();

drop trigger if exists goal_series_habits_set_updated_at on public.goal_series_habits;
create trigger goal_series_habits_set_updated_at
  before update on public.goal_series_habits
  for each row execute function public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
