-- Backfill display_ends_at for approved campaigns approved before participation-at-approval shipped.
-- Run once in Supabase SQL editor.

update community_campaigns
set display_ends_at = approved_at + (duration_days || ' days')::interval
where status in ('approved', 'active')
  and display_ends_at is null
  and approved_at is not null;
