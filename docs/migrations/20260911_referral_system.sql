-- Referral system: every profile gets a unique referral_code; referred_by
-- immutably records who invited them; referral_credits is the append-only
-- ledger of counted referrals (verified + joined a campaign or created a
-- first Forfeit). 100 points per counted referral.

-- 1. Fix the dead referral_code stub: enforce uniqueness (server-generated only from here on).
create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (referral_code)
  where referral_code is not null;

alter table public.profiles
  add column if not exists referred_by text;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create table if not exists public.referral_credits (
  id                      uuid        primary key default gen_random_uuid(),
  referrer_wallet         text        not null,
  referred_wallet         text        not null unique,
  qualifying_action       text        not null check (qualifying_action in ('forfeit', 'campaign_join')),
  forfeit_commitment_id   uuid        references public.forfeit_commitments (id),
  campaign_participant_id uuid        references public.campaign_participants (id),
  points_awarded          integer     not null default 100,
  credited_at             timestamptz not null default now()
);

create index if not exists referral_credits_referrer_idx
  on public.referral_credits (referrer_wallet);

comment on table public.referral_credits is
  'Append-only log of counted referrals: referred_wallet became GoodDollar-verified AND either joined a community campaign or created their first Forfeit commitment. One row per referred_wallet (unique) => double-credit guard. 100 points per row.';

-- Deny anon/authenticated Data API access; app uses service role only (same pattern as forfeit tables).
alter table public.referral_credits enable row level security;

-- 4. Read-optimized aggregate for the leaderboard route — plain view, no RPC needed.
create or replace view public.referral_leaderboard_v as
  select referrer_wallet          as wallet_address,
         count(*)::int            as referral_count,
         sum(points_awarded)::int as points,
         max(credited_at)         as last_referral_at
  from public.referral_credits
  group by referrer_wallet;

-- 5. One-time backfill so existing rows aren't stuck without a code
--    (new rows are backfilled lazily by ensureReferralCode() at read/write time).
do $$
declare r record;
declare candidate text;
begin
  for r in select address from public.profiles where referral_code is null loop
    loop
      candidate := upper(substr(md5(random()::text || r.address || clock_timestamp()::text), 1, 8));
      begin
        update public.profiles set referral_code = candidate where address = r.address;
        exit;
      exception when unique_violation then
        -- retry with a new candidate
      end;
    end loop;
  end loop;
end $$;
