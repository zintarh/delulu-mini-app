-- App-wide switches an admin can flip without a deploy (Admin → Home).
-- One row per switch; value is a small JSON object.
--
--   flow_vote  {"enabled": true|false}  The "Vote for Delulu" popup, the vote
--              gate before actions, the Home vote card and vote nudges.
--
-- Safe to run more than once.

create table if not exists public.app_settings (
  key         text        primary key,
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

insert into public.app_settings (key, value) values ('flow_vote', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;

-- Server (service role) only. Players read it through /api/flags.
alter table public.app_settings enable row level security;
