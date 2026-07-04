-- Allow "left" as a valid campaign_participants status.
-- The "Leave campaign" feature (POST /api/community/campaigns/[id]/leave)
-- sets status to "left", but the original check constraint only allowed
-- 'joined' and 'withdrawn', causing every leave attempt to fail with:
-- "new row for relation campaign_participants violates check constraint
--  campaign_participants_status_check"
ALTER TABLE campaign_participants DROP CONSTRAINT IF EXISTS campaign_participants_status_check;
ALTER TABLE campaign_participants ADD CONSTRAINT campaign_participants_status_check
  CHECK (status IN ('joined', 'withdrawn', 'left'));
