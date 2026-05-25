-- In-app notifications storage
-- Run this in Supabase SQL editor (after PUSH_NOTIFICATIONS_SUPABASE.sql)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_address text not null,
  type text not null default 'system',
  message text not null,
  image_url text,
  action_url text,
  actor_address text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_address, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (recipient_address)
  where read_at is null;
