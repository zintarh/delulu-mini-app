-- Add live-camera proof type support to community campaigns
ALTER TABLE community_campaigns
  ADD COLUMN IF NOT EXISTS proof_type text NOT NULL DEFAULT 'screenshot'
    CHECK (proof_type IN ('screenshot', 'live_camera'));

ALTER TABLE community_campaigns
  ADD COLUMN IF NOT EXISTS live_camera_duration_seconds integer
    CHECK (live_camera_duration_seconds IS NULL OR live_camera_duration_seconds IN (60, 120, 180, 240, 300));

ALTER TABLE community_campaigns
  ADD CONSTRAINT community_campaigns_proof_type_duration_ck
    CHECK (
      (proof_type = 'live_camera' AND live_camera_duration_seconds IS NOT NULL)
      OR (proof_type = 'screenshot' AND live_camera_duration_seconds IS NULL)
    );
