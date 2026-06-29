-- Add optional Telegram group link to community campaigns
ALTER TABLE community_campaigns ADD COLUMN IF NOT EXISTS telegram_link text;
