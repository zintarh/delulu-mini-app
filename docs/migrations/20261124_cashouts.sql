-- Cash out: G$ to a Nigerian bank account through GoodCash (lib/cashout).
--
-- One row per cash out we created. GoodCash is the source of truth for
-- status; we mirror it from the signed webhook and from secret-key reads, so
-- the admin totals ("G$ withdrawn, naira paid") come from GoodCash, never from
-- a browser. Test-key rows are kept apart by `mode` and never counted as live.
--
-- Bank details: only the bank's display name, the account holder's name (as
-- the bank returned it) and the last 4 digits. Full account numbers are never
-- stored here; saved accounts live on the player's own device.

create table if not exists public.cashouts (
  id                 uuid        primary key,            -- GoodCash's cash-out id
  mode               text        not null check (mode in ('live', 'test')),
  wallet             text        not null,               -- lowercase
  amount_g           numeric     not null check (amount_g > 0),
  naira              numeric     not null default 0,     -- what the bank gets (GoodCash's figure)
  naira_per_dollar   numeric     not null default 0,     -- rate at the time, for the record
  account_name       text        not null,
  bank_name          text        not null,
  account_last4      text        not null,
  status             text        not null default 'awaiting_signature'
                       check (status in ('awaiting_signature', 'sent', 'processing', 'paid', 'failed', 'refunded', 'expired')),
  tx_hash            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  paid_at            timestamptz
);

create index if not exists cashouts_wallet_idx on public.cashouts (wallet, created_at desc);
create index if not exists cashouts_mode_status_idx on public.cashouts (mode, status, paid_at desc);

-- Webhook events already handled (GoodCash may deliver one twice).
create table if not exists public.cashout_webhook_events (
  id          text        primary key,
  received_at timestamptz not null default now()
);

-- The webhook signing secret GoodCash returns once, when an admin presses
-- "Connect webhook" (or set GOODCASH_WEBHOOK_SECRET by hand instead).
create table if not exists public.cashout_settings (
  mode            text        primary key check (mode in ('live', 'test')),
  webhook_secret  text,
  updated_at      timestamptz not null default now()
);

-- Server only (service role). No public access.
alter table public.cashouts enable row level security;
alter table public.cashout_webhook_events enable row level security;
alter table public.cashout_settings enable row level security;
