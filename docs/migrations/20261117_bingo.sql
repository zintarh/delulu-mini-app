-- Bingo campaigns (20261117)
--
-- A reusable layer over the existing money rails — no new staking system:
--   • 7-day fixed cycles: each stake tier of a cycle is an ordinary
--     community_campaigns row + CommunityMarketV1 campaign (join stake,
--     daily proof windows, forfeit % per missed day, payout pool). The
--     server signer creates them; joins/proofs/reclaims reuse the campaign flow.
--   • 3-day rolling attempts: each attempt is backed by its own stake
--     (ForfeitMarket commitment, personal clock) — wired in a later phase.
-- These tables hold the card, versions, cycles and history. Nothing here is
-- ever deleted when a Bingo restarts: a new cycle is new rows.

-- ── Campaigns (the template an admin manages) ──────────────────────────────
create table if not exists public.bingo_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  title text not null check (length(title) between 3 and 80),
  description text,
  cover_image_url text,
  duration_days int not null check (duration_days in (3, 7)),
  enrollment text not null check (enrollment in ('fixed', 'rolling')),
  recurrence text not null default 'one_time' check (recurrence in ('one_time', 'automatic', 'manual')),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'archived')),
  current_version_id uuid,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Versions: missions + tiers frozen per edit ─────────────────────────────
-- Editing a Bingo writes a new version; running cycles and attempts keep the
-- version they started on, so edits only reach future cycles.
--   missions: [{ "title": "Capture the sky", "bonus": false }, ...]
--   tiers:    [{ "key": "starter", "label": "Starter", "stake": 1000, "forfeitPct": 10 }, ...]
create table if not exists public.bingo_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.bingo_campaigns(id) on delete restrict,
  version int not null check (version > 0),
  missions jsonb not null check (jsonb_typeof(missions) = 'array'),
  tiers jsonb not null check (jsonb_typeof(tiers) = 'array'),
  created_by text,
  created_at timestamptz not null default now(),
  unique (campaign_id, version)
);

do $$ begin
  alter table public.bingo_campaigns
    add constraint bingo_campaigns_current_version_fk
    foreign key (current_version_id) references public.bingo_versions(id);
exception when duplicate_object then null; end $$;

-- ── Cycles (fixed enrollment) ──────────────────────────────────────────────
create table if not exists public.bingo_cycles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.bingo_campaigns(id) on delete restrict,
  version_id uuid not null references public.bingo_versions(id),
  cycle_number int not null check (cycle_number > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- scheduled → setting_up → ready (joinable; live once starts_at passes)
  -- → ending → archived.  failed = on-chain setup error, retried by the cron.
  status text not null default 'scheduled'
    check (status in ('scheduled', 'setting_up', 'ready', 'failed', 'ending', 'archived', 'cancelled')),
  locked_at timestamptz,
  last_error text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, cycle_number),
  check (ends_at > starts_at)
);
create index if not exists bingo_cycles_status_idx on public.bingo_cycles (status, starts_at);

-- One on-chain campaign per stake tier per cycle, plus one free campaign per
-- bonus square (tier_key "bonus_<square>", stake 0, a single window covering
-- the whole cycle) so bonus photos are proven on-chain and earn points.
create table if not exists public.bingo_cycle_tiers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.bingo_cycles(id) on delete restrict,
  tier_key text not null,
  label text not null,
  stake_amount numeric not null check (stake_amount >= 0),
  forfeit_pct int not null check (forfeit_pct in (0, 2, 5, 10)),
  community_campaign_id uuid unique references public.community_campaigns(id),
  on_chain_challenge_id int unique,
  -- pending → created → economics_set → ready
  setup_step text not null default 'pending' check (setup_step in ('pending', 'created', 'economics_set', 'ready')),
  create_tx text,
  economics_tx text,
  milestones_tx text,
  end_tx text,
  last_error text,
  setup_attempts int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, tier_key)
);

alter table public.community_campaigns
  add column if not exists bingo_cycle_id uuid references public.bingo_cycles(id);
create index if not exists community_campaigns_bingo_cycle_idx
  on public.community_campaigns (bingo_cycle_id) where bingo_cycle_id is not null;

-- ── Attempts: one player's card ────────────────────────────────────────────
create table if not exists public.bingo_attempts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.bingo_campaigns(id) on delete restrict,
  version_id uuid not null references public.bingo_versions(id),
  cycle_id uuid references public.bingo_cycles(id),          -- fixed cycles
  cycle_tier_id uuid references public.bingo_cycle_tiers(id),
  tier_key text not null,
  wallet text not null check (wallet = lower(wallet)),
  stake_amount numeric not null default 0,
  forfeit_commitment_id bigint,                               -- rolling attempts
  join_tx text unique,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  -- active → completed (every required square) | finished (ended short)
  status text not null default 'active' check (status in ('active', 'completed', 'finished', 'left')),
  squares_filled int not null default 0,
  required_filled int not null default 0,
  last_filled_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > started_at)
);
create unique index if not exists bingo_attempts_cycle_wallet_uq
  on public.bingo_attempts (cycle_id, wallet) where cycle_id is not null;
create unique index if not exists bingo_attempts_rolling_active_uq
  on public.bingo_attempts (campaign_id, wallet) where cycle_id is null and status = 'active';
create index if not exists bingo_attempts_wallet_idx on public.bingo_attempts (wallet, status);
create index if not exists bingo_attempts_board_idx
  on public.bingo_attempts (cycle_id, squares_filled desc, last_filled_at);

-- ── Squares: approved photos on a card ─────────────────────────────────────
-- 'confirming' = approved by review, waiting for the on-chain proof tx;
-- only 'filled' counts. Rejections live in proof_image_fingerprints.
create table if not exists public.bingo_squares (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.bingo_attempts(id) on delete restrict,
  square_index int not null check (square_index between 0 and 8),
  mission_title text not null,
  bonus boolean not null default false,
  slot_index int,                     -- on-chain day slot; null for bonus squares
  proof_url text not null,
  status text not null check (status in ('confirming', 'filled')),
  proof_tx text unique,
  review_note text,
  approved_at timestamptz not null default now(),
  filled_at timestamptz,
  unique (attempt_id, square_index)
);
create unique index if not exists bingo_squares_slot_uq
  on public.bingo_squares (attempt_id, slot_index) where slot_index is not null and status = 'filled';
create index if not exists bingo_squares_feed_idx on public.bingo_squares (filled_at desc) where status = 'filled';

-- ── Event log: on-chain setup, cycle changes, failures (admin visibility) ──
create table if not exists public.bingo_events (
  id bigserial primary key,
  campaign_id uuid references public.bingo_campaigns(id),
  cycle_id uuid references public.bingo_cycles(id),
  cycle_tier_id uuid references public.bingo_cycle_tiers(id),
  kind text not null,
  ok boolean not null default true,
  tx_hash text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists bingo_events_recent_idx on public.bingo_events (created_at desc);

-- Referrals: a friend who stakes on a Bingo card (e.g. My First 3's 100 G$)
-- counts — joining with money on the line is the qualifying action.
alter table public.referral_credits drop constraint if exists referral_credits_qualifying_action_check;
alter table public.referral_credits
  add constraint referral_credits_qualifying_action_check
  check (qualifying_action in ('forfeit', 'campaign_join', 'bingo_join'));

-- Service role only (all access goes through the API).
alter table public.bingo_campaigns enable row level security;
alter table public.bingo_versions enable row level security;
alter table public.bingo_cycles enable row level security;
alter table public.bingo_cycle_tiers enable row level security;
alter table public.bingo_attempts enable row level security;
alter table public.bingo_squares enable row level security;
alter table public.bingo_events enable row level security;

notify pgrst, 'reload schema';
