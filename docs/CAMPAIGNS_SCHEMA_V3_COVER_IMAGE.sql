-- Phase 2.5: Optional campaign cover image
-- Run in Supabase SQL editor AFTER CAMPAIGNS_SCHEMA.sql (and V2 alter if applied)

alter table community_campaigns
  add column if not exists cover_image_url text;
