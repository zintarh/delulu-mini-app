-- Partner referral links (e.g. staydelulu.xyz/join/BIGJAY) and a daily presence log.
--
-- A partner's code is also written to their own profiles.referral_code, so the
-- normal sign-up attribution (lib/referral/attribution.ts) links friends to them
-- with no special path. The partner sees their friends at /partner/<CODE>.

create table if not exists public.referral_partners (
  code          text        primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  owner_wallet  text        unique,                 -- lowercase; null until the partner has signed up
  name          text        not null,
  min_points    int         not null default 100, -- one kept photo on a 100 G$ card (plus verified, claimed, staked, joined)
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One row per wallet per Lagos day the app was open (from /api/me/presence).
-- Lets "came back on N days" be counted, not just "last seen".
create table if not exists public.presence_days (
  wallet  text not null,
  day     date not null,
  primary key (wallet, day)
);
create index if not exists presence_days_day_idx on public.presence_days (day);

alter table public.referral_partners enable row level security;
alter table public.presence_days enable row level security;

insert into public.referral_partners (code, name, min_points) values ('BIGJAY', 'Big J', 100)
on conflict (code) do update set min_points = 100
  where referral_partners.min_points = 10000;
