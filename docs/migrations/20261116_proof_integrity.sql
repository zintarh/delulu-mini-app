-- Proof integrity: stop reused, old and duplicate-habit proofs from earning.
--
-- 1. proof_image_fingerprints — every AI-reviewed proof image, so the same
--    photo can't back a second day, a second goal or a second wallet.
--    sha256 catches byte-identical reuse; dhash (256-bit difference hash)
--    finds resized / re-saved copies, which the AI then compares side by side.
-- 2. reserve_daily_proof_reward gains p_sibling_refs: a wallet's goals with
--    the same habit (normalised title) share one daily reward.
--
-- Needs Postgres 14+ (bit_count on bit strings). Safe to run more than once.
-- Run BEFORE deploying the code that calls these.

-- ── Fingerprints ────────────────────────────────────────────────────────────
create table if not exists public.proof_image_fingerprints (
  id           uuid        primary key default gen_random_uuid(),
  wallet       text        not null,
  kind         text        not null check (kind in ('campaign', 'forfeit')),
  ref_id       text        not null,
  -- The day the proof is for: forfeit "<commitment id>:<period index>",
  -- campaign "<campaign id>:<milestone id>". Re-using an image for the same
  -- wallet + period is a retry (e.g. the wallet tx failed), not reuse.
  period_key   text        not null,
  proof_url    text        not null,
  sha256       text        not null,
  dhash        bit(256),
  width        integer,
  height       integer,
  taken_at     timestamptz,
  status       text        not null check (status in ('accepted', 'rejected')),
  reject_code  text,
  reject_note  text,
  created_at   timestamptz not null default now()
);

create index if not exists proof_image_fingerprints_sha_idx
  on public.proof_image_fingerprints (sha256) where status = 'accepted';
create index if not exists proof_image_fingerprints_wallet_idx
  on public.proof_image_fingerprints (wallet, created_at desc);
create index if not exists proof_image_fingerprints_reject_idx
  on public.proof_image_fingerprints (reject_code, created_at desc) where status = 'rejected';

alter table public.proof_image_fingerprints enable row level security;

comment on table public.proof_image_fingerprints is
  'One row per AI-reviewed proof image (lib/proof-integrity). Only accepted rows block reuse; rejected rows are kept for abuse review.';

-- Accepted images that match by exact hash, or by perceptual hash within
-- p_max_distance bits — excluding this wallet's own earlier tries for the
-- same period. Exact matches first, then nearest.
create or replace function public.find_proof_image_matches(
  p_sha256       text,
  p_dhash        bit(256),
  p_max_distance integer,
  p_wallet       text,
  p_period_key   text
) returns table (
  wallet      text,
  proof_url   text,
  period_key  text,
  exact       boolean,
  distance    integer,
  created_at  timestamptz
)
language sql
stable
as $$
  select f.wallet,
         f.proof_url,
         f.period_key,
         f.sha256 = p_sha256 as exact,
         case when f.dhash is null or p_dhash is null then null
              else bit_count(f.dhash # p_dhash)::int end as distance,
         f.created_at
    from public.proof_image_fingerprints f
   where f.status = 'accepted'
     and not (f.wallet = p_wallet and f.period_key = p_period_key)
     and (
       f.sha256 = p_sha256
       or (p_dhash is not null and f.dhash is not null and bit_count(f.dhash # p_dhash) <= p_max_distance)
     )
   order by (f.sha256 = p_sha256) desc, distance asc nulls last, f.created_at asc
   limit 5;
$$;

revoke all on function public.find_proof_image_matches(text, bit, integer, text, text)
  from public, anon, authenticated;

-- ── One daily reward per habit ──────────────────────────────────────────────
-- Same body as 20261111_rewards_engine.sql plus the sibling check. The old
-- 9-arg version is dropped so PostgREST can't pick it by mistake; the new
-- param defaults to null, so callers that don't pass it behave as before.
drop function if exists public.reserve_daily_proof_reward(text, text, text, date, numeric, integer, text, text, uuid);

create or replace function public.reserve_daily_proof_reward(
  p_wallet          text,
  p_goal_kind       text,
  p_goal_ref        text,
  p_day             date,
  p_amount          numeric,
  p_max_goals       integer,
  p_dedupe_key      text,
  p_reward_id       text,
  p_source_proof_id uuid,
  p_sibling_refs    text[] default null
) returns jsonb
language plpgsql
as $$
declare
  existing   public.reward_payouts%rowtype;
  slot       public.reward_goal_slots%rowtype;
  used_today integer;
  held       integer;
  new_id     uuid;
begin
  perform pg_advisory_xact_lock(hashtext('rewards:' || p_wallet));

  select * into existing from public.reward_payouts where dedupe_key = p_dedupe_key;
  if found then
    return jsonb_build_object('outcome', 'exists', 'payout_id', existing.id, 'status', existing.status);
  end if;

  -- Another goal for the same habit already earned today's reward.
  if p_sibling_refs is not null and cardinality(p_sibling_refs) > 0 and exists (
    select 1 from public.reward_payouts
     where wallet = p_wallet
       and category = 'daily_proof'
       and reward_day = p_day
       and goal_kind = p_goal_kind
       and goal_ref = any (p_sibling_refs)
  ) then
    return jsonb_build_object('outcome', 'same_habit');
  end if;

  select * into slot from public.reward_goal_slots
   where wallet = p_wallet and goal_kind = p_goal_kind and goal_ref = p_goal_ref
   for update;
  if found and slot.released_at is not null and p_day > coalesce(slot.released_day, p_day - 1) then
    return jsonb_build_object('outcome', 'goal_released');
  end if;

  select count(*) into used_today from public.reward_payouts
   where wallet = p_wallet and category = 'daily_proof' and reward_day = p_day;
  if used_today >= p_max_goals then
    return jsonb_build_object('outcome', 'daily_limit');
  end if;

  if slot.id is null then
    -- New goal: needs a free slot (held and cooling-down slots both count).
    select count(*) into held from public.reward_goal_slots
     where wallet = p_wallet
       and (released_at is null or cooldown_until > p_day);
    if held >= p_max_goals then
      return jsonb_build_object('outcome', 'goal_limit');
    end if;
    insert into public.reward_goal_slots (wallet, goal_kind, goal_ref, claimed_day, last_active_day)
    values (p_wallet, p_goal_kind, p_goal_ref, p_day, p_day);
  elsif slot.released_at is null then
    update public.reward_goal_slots
       set last_active_day = greatest(last_active_day, p_day)
     where id = slot.id;
  end if;

  insert into public.reward_payouts
    (wallet, category, amount, dedupe_key, reward_id, goal_kind, goal_ref, period_key, reward_day, source_proof_id)
  values
    (p_wallet, 'daily_proof', p_amount, p_dedupe_key, p_reward_id, p_goal_kind, p_goal_ref, p_day::text, p_day, p_source_proof_id)
  returning id into new_id;

  return jsonb_build_object('outcome', 'reserved', 'payout_id', new_id, 'status', 'pending');
end;
$$;

revoke all on function public.reserve_daily_proof_reward(text, text, text, date, numeric, integer, text, text, uuid, text[])
  from public, anon, authenticated;
