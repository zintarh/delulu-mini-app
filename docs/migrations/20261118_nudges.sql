-- Nudges + retention analytics (20261118). Safe to run more than once.

-- Presence: when someone was last in the app, and whether they've installed
-- it (opened from the home screen / accepted the install prompt).
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists pwa_installed_at timestamptz;
alter table public.profiles add column if not exists last_standalone_at timestamptz;
alter table public.profiles add column if not exists platform text;
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- Every nudge the system sends (or deliberately skips), so it never repeats
-- itself, respects the one-a-day cap, and analytics can show what works:
-- acted_at is set when the person did the nudged thing within 24h.
create table if not exists public.nudge_log (
  id bigserial primary key,
  wallet text not null check (wallet = lower(wallet)),
  rule text not null,
  -- One send per (wallet, rule, key) ever — e.g. key = attempt id + day.
  dedupe_key text not null,
  channel text not null check (channel in ('push', 'email')),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  detail text,
  sent_at timestamptz not null default now(),
  acted_at timestamptz,
  unique (wallet, rule, dedupe_key)
);
create index if not exists nudge_log_wallet_idx on public.nudge_log (wallet, sent_at desc);
create index if not exists nudge_log_rule_idx on public.nudge_log (rule, sent_at desc);

alter table public.nudge_log enable row level security;

notify pgrst, 'reload schema';
