-- Forfeit feature: off-chain metadata/workflow tables backing ForfeitMarket.sol.
-- Run once in Supabase SQL editor.
--
-- The contract (ForfeitMarket.sol) is the source of truth for money-moving state
-- (stake, deadlines, resolution outcome, payout destination). These tables hold
-- everything the contract deliberately doesn't store: descriptive metadata, the
-- friend-verifier invite workflow, and per-period proof history.

create table if not exists public.forfeit_commitments (
  id                    uuid         primary key default gen_random_uuid(),
  on_chain_commitment_id bigint      unique,
  creator_wallet        text         not null,
  title                 text         not null,
  description           text,
  evidence_type         text         not null
                        check (evidence_type in ('photo', 'camera', 'timelapse', 'gps', 'strava', 'google_health')),
  verification_method   text         not null default 'ai'
                        check (verification_method in ('self', 'friend', 'ai')),
  is_private            boolean      not null default false,
  remind_enabled        boolean      not null default true,
  -- Charity vs Delulu both map to CommunityPool on-chain; this records intent.
  is_charity_intent     boolean      not null default false,
  -- Snapshot at create time so feed UI doesn't depend on subgraph lag.
  stake_amount_wei      text,
  token                 text,
  destination_type      int,
  destination_addr      text,
  destination_friend_username text,
  destination_friend_email    text,
  verifier_wallet        text,        -- nullable until an existing user is resolved, or an invite is accepted
  status                text         not null default 'pending_confirmation'
                        check (status in ('pending_confirmation', 'active', 'completed', 'forfeited', 'cancelled')),
  create_tx_hash         text,
  created_at            timestamptz  not null default now(),
  confirmed_at           timestamptz
);

-- Idempotency guard so confirm-create never double-processes the same tx.
create unique index if not exists forfeit_commitments_create_tx_hash
  on public.forfeit_commitments (create_tx_hash)
  where create_tx_hash is not null;

create index if not exists forfeit_commitments_creator_wallet_idx
  on public.forfeit_commitments (creator_wallet);

-- Per-period proof/outcome history — the rich detail ForfeitMarket.sol intentionally
-- doesn't store on-chain (it only tracks whether the current period is resolved).
create table if not exists public.forfeit_periods (
  id              uuid         primary key default gen_random_uuid(),
  commitment_id   uuid         not null references public.forfeit_commitments (id) on delete cascade,
  period_index    int          not null,
  proof_url       text,
  ai_verdict      jsonb,
  verifier_action text
                  check (verifier_action in ('approved', 'rejected', 'timed_out')),
  resolved_at     timestamptz,
  tx_hash         text,
  created_at      timestamptz  not null default now(),
  unique (commitment_id, period_index)
);

-- Friend-verifier invite workflow: the creator only supplies a username + email at
-- creation time, not a wallet, so this drives the invite email and, once the friend
-- shows up, the on-chain acceptVerifierInvite() call.
create table if not exists public.forfeit_verifier_invites (
  id               uuid         primary key default gen_random_uuid(),
  commitment_id    uuid         not null references public.forfeit_commitments (id) on delete cascade,
  friend_username  text,        -- set only when resolved to an existing user at creation
  friend_email     text         not null,
  invite_code_hash text         not null,  -- hex of keccak256(code); matches ForfeitMarket.pendingVerifierCodeHash
  status           text         not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined')),
  resolved_wallet  text,        -- set once accepted
  invited_at       timestamptz  not null default now(),
  accepted_at      timestamptz,
  unique (commitment_id)
);

-- Reminder scheduling, picked up by the existing email-reminders/push-reminders cron
-- jobs (extended to also query this table) rather than inventing new scheduling infra.
create table if not exists public.forfeit_reminders (
  id             uuid         primary key default gen_random_uuid(),
  commitment_id  uuid         not null references public.forfeit_commitments (id) on delete cascade,
  reminder_type  text         not null
                 check (reminder_type in ('period_deadline', 'verifier_accept', 'verifier_review')),
  next_fire_at   timestamptz  not null,
  last_fired_at  timestamptz,
  created_at     timestamptz  not null default now()
);

create index if not exists forfeit_reminders_due_idx
  on public.forfeit_reminders (next_fire_at)
  where last_fired_at is null;
