-- Enforce one email per profile, case-insensitively.
--
-- The `unique` constraint documented on profiles.email in ALL_TABLES.sql was
-- never actually applied to production: 9 emails were found shared across
-- 2-4 different wallet addresses each. Those were resolved on 2026-07-24
-- (all but the most-active address per email rewritten to an
-- "<address>@wallet.local" placeholder, the same convention already used
-- for wallet-only signups).
--
-- A plain `unique` constraint on the raw column would still allow
-- "John@Gmail.com" and "john@gmail.com" as two different rows, so this uses
-- a unique index on lower(email) instead — matches how every read path
-- (check-email, profile/email) already compares case-insensitively.
--
-- Run this only after confirming no duplicates remain:
--   select lower(email), count(*) from profiles
--   where email not ilike '%@wallet.local'
--   group by lower(email) having count(*) > 1;
-- (should return zero rows)

create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email));
