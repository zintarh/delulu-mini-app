-- Merkle payout snapshot for ended community campaigns (Phase 3 winner claims).

alter table community_campaigns
  add column if not exists payout_merkle_root text,
  add column if not exists payout_total_claimable_wei text,
  add column if not exists payout_published_at timestamptz;

comment on column community_campaigns.payout_merkle_root is
  'On-chain / off-chain merkle root for winner claims (0x-prefixed hex)';
comment on column community_campaigns.payout_total_claimable_wei is
  'Sum of leaf amounts in wei (string to avoid js precision loss)';
comment on column community_campaigns.payout_published_at is
  'When setCommunityPayoutRoot was confirmed';

create table if not exists campaign_payout_claims (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references community_campaigns(id) on delete cascade,
  wallet_address  text not null,
  amount_wei      text not null,
  rank            int not null,
  points_total    numeric not null default 0,
  claimed_at      timestamptz,
  claim_tx_hash   text,
  created_at      timestamptz not null default now(),
  unique (campaign_id, wallet_address)
);

create index if not exists idx_campaign_payout_claims_campaign
  on campaign_payout_claims (campaign_id);
create index if not exists idx_campaign_payout_claims_wallet
  on campaign_payout_claims (wallet_address);
