-- Audit log for admin RewardVault grants (depositReward).
-- Lets ops trace who was rewarded, by whom, how much, and the on-chain tx.

create table if not exists public.admin_reward_grants (
  id                   uuid primary key default gen_random_uuid(),
  recipient_address    text not null,
  recipient_username   text,
  recipient_email      text,
  token_address        text not null,
  token_symbol         text not null,
  amount               numeric not null,
  amount_wei           text not null,
  reason               text,
  tx_hash              text not null,
  reward_id            text,
  vault_address        text,
  sender_address       text not null,
  staff_user_id        uuid,
  staff_email          text,
  email_sent           boolean not null default false,
  email_error          text,
  created_at           timestamptz not null default now(),
  unique (tx_hash)
);

create index if not exists admin_reward_grants_recipient_idx
  on public.admin_reward_grants (recipient_address);

create index if not exists admin_reward_grants_sender_idx
  on public.admin_reward_grants (sender_address);

create index if not exists admin_reward_grants_created_idx
  on public.admin_reward_grants (created_at desc);

create index if not exists admin_reward_grants_token_idx
  on public.admin_reward_grants (token_address);

comment on table public.admin_reward_grants is
  'Append-only audit of admin RewardVault depositReward grants for later tracing.';

-- Deny anon/authenticated Data API access; app uses service role only.
alter table public.admin_reward_grants enable row level security;
