-- Let admins hide a campaign from public feeds/discovery without deleting it
ALTER TABLE community_campaigns
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
