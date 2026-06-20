-- Phase 2b: Campaign duration + prize winner count
-- Run AFTER CAMPAIGNS_SCHEMA.sql if tables already exist

alter table community_campaigns
  add column if not exists duration_days integer not null default 30
    check (duration_days > 0);

alter table community_campaigns
  add column if not exists prize_winner_count integer not null default 10
    check (prize_winner_count in (5, 10, 20));
