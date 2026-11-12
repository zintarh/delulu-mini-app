-- Delulu Support System (Milestone 3)
-- Public/private visibility on Delulus (forfeit_commitments), peer-to-peer G$
-- support records, support milestones, and the notification types they use.
--
-- Self-contained and idempotent: safe to run more than once in the Supabase
-- SQL editor. Nothing here deletes or rewrites existing rows; every existing
-- Delulu stays private.

-- Wrong-database guard: the app's project (ref rwqvqsglqqzgabzjpinb) has
-- public.forfeit_commitments with live Delulus. Anywhere else, stop clearly.
do $$
begin
  if to_regclass('public.forfeit_commitments') is null then
    raise exception 'Wrong database: public.forfeit_commitments is missing here (current_database=%). Open the Supabase project with ref rwqvqsglqqzgabzjpinb (main branch, not a preview branch) and run this again.', current_database();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Visibility + public profile of a Delulu
-- ---------------------------------------------------------------------------
alter table public.forfeit_commitments
  add column if not exists public_description text,
  add column if not exists category text,
  add column if not exists public_since timestamptz,
  add column if not exists visibility_updated_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists support_total_wei numeric(78, 0) not null default 0,
  add column if not exists supporter_count int not null default 0,
  add column if not exists last_supported_at timestamptz;

-- Private stays the default for every new Delulu.
alter table public.forfeit_commitments alter column is_private set default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forfeit_commitments_category_check'
  ) then
    alter table public.forfeit_commitments
      add constraint forfeit_commitments_category_check
      check (category is null or category in (
        'fitness', 'learning', 'productivity', 'personal_development', 'finance', 'lifestyle'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'forfeit_commitments_public_description_len'
  ) then
    alter table public.forfeit_commitments
      add constraint forfeit_commitments_public_description_len
      check (public_description is null or char_length(public_description) <= 280);
  end if;
end $$;

-- Discovery only ever scans public, active rows.
create index if not exists forfeit_commitments_public_discovery_idx
  on public.forfeit_commitments (status, public_since desc)
  where is_private = false;

-- ---------------------------------------------------------------------------
-- 2. Support records
-- ---------------------------------------------------------------------------
-- One row per support attempt. Money moves wallet → wallet on-chain; this row
-- is only marked 'confirmed' after the server has read the matching ERC-20
-- Transfer event from the receipt.
create table if not exists public.delulu_supports (
  id                      uuid         primary key default gen_random_uuid(),
  commitment_id           uuid         not null references public.forfeit_commitments (id) on delete restrict,
  on_chain_commitment_id  bigint       not null,
  supporter_wallet        text         not null,
  recipient_wallet        text         not null,
  token                   text         not null,
  amount_wei              numeric(78, 0) not null check (amount_wei > 0),
  -- Client-generated per confirm tap: a retried "create" returns the same row.
  client_request_id       text         not null,
  tx_hash                 text,
  status                  text         not null default 'pending'
                          check (status in ('pending', 'submitted', 'confirmed', 'failed', 'expired')),
  attempts                int          not null default 0,
  last_error              text,
  block_number            bigint,
  submitted_at            timestamptz,
  confirmed_at            timestamptz,
  failed_at               timestamptz,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now(),
  check (supporter_wallet <> recipient_wallet),
  check (status <> 'confirmed' or tx_hash is not null)
);

create unique index if not exists delulu_supports_client_request_uidx
  on public.delulu_supports (supporter_wallet, client_request_id);
-- A transaction can back at most one support record — retries can't duplicate.
create unique index if not exists delulu_supports_tx_hash_uidx
  on public.delulu_supports (lower(tx_hash))
  where tx_hash is not null;
create index if not exists delulu_supports_commitment_idx
  on public.delulu_supports (commitment_id, created_at desc);
create index if not exists delulu_supports_supporter_idx
  on public.delulu_supports (supporter_wallet, created_at desc);
create index if not exists delulu_supports_recipient_idx
  on public.delulu_supports (recipient_wallet, created_at desc);
create index if not exists delulu_supports_open_idx
  on public.delulu_supports (status, created_at)
  where status in ('pending', 'submitted');

create or replace function public.delulu_supports_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists delulu_supports_updated_at on public.delulu_supports;
create trigger delulu_supports_updated_at
  before update on public.delulu_supports
  for each row execute function public.delulu_supports_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Support milestones (each reached once per Delulu)
-- ---------------------------------------------------------------------------
create table if not exists public.delulu_support_milestones (
  id             uuid        primary key default gen_random_uuid(),
  commitment_id  uuid        not null references public.forfeit_commitments (id) on delete cascade,
  milestone      text        not null,
  reached_at     timestamptz not null default now(),
  unique (commitment_id, milestone)
);

-- ---------------------------------------------------------------------------
-- 4. Totals — always recomputed from confirmed rows (retry-safe, never +=)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_delulu_support_totals(p_commitment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(78, 0);
  v_count int;
  v_last timestamptz;
begin
  select coalesce(sum(amount_wei), 0), count(distinct supporter_wallet), max(confirmed_at)
    into v_total, v_count, v_last
    from public.delulu_supports
   where commitment_id = p_commitment_id
     and status = 'confirmed';

  update public.forfeit_commitments
     set support_total_wei = v_total,
         supporter_count = v_count,
         last_supported_at = v_last
   where id = p_commitment_id;

  return jsonb_build_object(
    'total_wei', v_total::text,
    'supporter_count', v_count,
    'last_supported_at', v_last
  );
end $$;

revoke all on function public.refresh_delulu_support_totals(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS — server (service role) only, like the other app tables
-- ---------------------------------------------------------------------------
alter table public.delulu_supports enable row level security;
alter table public.delulu_support_milestones enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Notification types
-- ---------------------------------------------------------------------------
-- The live check constraint only allowed the original ten types, which also
-- silently rejected every forfeit_* in-app notification. Rebuild it with the
-- full app-level NotificationType union (src/lib/notifications.ts).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'milestone_due',
    'delulu_ending',
    'stake',
    'like',
    'comment',
    'tip',
    'system',
    'campaign_milestone_due',
    'campaign_ending',
    'campaign_proof_submitted',
    'forfeit_resolved',
    'forfeit_verifier_tagged',
    'forfeit_proof_submitted',
    'forfeit_destination_tagged',
    'forfeit_friend_reward',
    'delulu_supported',
    'support_sent',
    'support_milestone',
    'supported_delulu_completed'
  ));
