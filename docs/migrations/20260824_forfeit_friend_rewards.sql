-- Audit log + notification ledger for Friend-destination ForfeitMarket rewards
-- (FriendRewardCredited events). Idempotent by subgraph event id (txHash-logIndex),
-- same pattern as admin_reward_grants (unique tx_hash). Also backs the "recent
-- forfeit rewards" history shown in the Claims tab — the claimable balance itself
-- is always read live from ForfeitMarket.pendingFriendReward, not this table.

create table if not exists public.forfeit_friend_rewards (
  id                   text primary key, -- subgraph event id: txHash-logIndex
  commitment_id        bigint not null,
  recipient_address    text not null,
  recipient_username   text,
  recipient_email      text,
  token_address        text not null,
  token_symbol         text not null,
  amount               numeric not null,
  amount_wei           text not null,
  tx_hash              text not null,
  created_at           timestamptz not null default now(),
  credited_at          timestamptz not null,
  email_sent           boolean not null default false,
  email_error          text
);

create index if not exists forfeit_friend_rewards_recipient_idx
  on public.forfeit_friend_rewards (recipient_address);

create index if not exists forfeit_friend_rewards_created_idx
  on public.forfeit_friend_rewards (created_at desc);

create index if not exists forfeit_friend_rewards_commitment_idx
  on public.forfeit_friend_rewards (commitment_id);

comment on table public.forfeit_friend_rewards is
  'Append-only log of Friend-destination ForfeitMarket forfeitures credited to pendingFriendReward, used for notification idempotency and Claims-tab history.';

-- Deny anon/authenticated Data API access; app uses service role only.
alter table public.forfeit_friend_rewards enable row level security;
