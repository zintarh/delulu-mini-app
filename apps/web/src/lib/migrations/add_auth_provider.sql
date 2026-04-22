-- Migration: add auth_provider column to profiles
-- Run once in Supabase SQL editor
-- All existing users default to 'privy'

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'privy';

-- Verify
SELECT auth_provider, COUNT(*) AS user_count
FROM profiles
GROUP BY auth_provider;
