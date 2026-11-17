-- Win-back outreach log (admin → Outreach → Win back). One row per email
-- sent, so the page can show "emailed 3d ago" and skip people emailed with
-- the same template recently. Safe to run more than once.

create table if not exists public.outreach_emails (
  id           uuid        primary key default gen_random_uuid(),
  wallet       text        not null,
  email        text        not null,
  template_id  text,
  subject      text        not null,
  resend_id    text,
  status       text        not null default 'sent' check (status in ('sent', 'failed')),
  error        text,
  sent_by      text,
  created_at   timestamptz not null default now()
);

create index if not exists outreach_emails_wallet_idx
  on public.outreach_emails (wallet, created_at desc);

alter table public.outreach_emails enable row level security;
