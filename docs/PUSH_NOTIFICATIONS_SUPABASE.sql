-- Delulu Web Push storage (Supabase/Postgres)
-- Run this in Supabase SQL editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists push_subscriptions_address_idx
  on public.push_subscriptions (address);

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (disabled_at)
  where disabled_at is null;

create table if not exists public.push_events_sent (
  event_key text primary key,
  address text,
  sent_at timestamptz not null default now()
);

create index if not exists push_events_sent_address_idx
  on public.push_events_sent (address);

-- Optional: keep updated_at fresh automatically
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

