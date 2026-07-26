-- Forfeit: charity intent flag + evidence types aligned with current create UI.
-- Run in Supabase SQL editor if forfeit_commitments already exists.

alter table public.forfeit_commitments
  add column if not exists is_charity_intent boolean not null default false;

-- Allow current evidence types (photo / camera / gps / strava / self-as-photo).
-- Drop old check if present, then re-add.
alter table public.forfeit_commitments
  drop constraint if exists forfeit_commitments_evidence_type_check;

alter table public.forfeit_commitments
  add constraint forfeit_commitments_evidence_type_check
  check (evidence_type in (
    'photo',
    'camera',
    'gps',
    'strava',
    'timelapse',
    'google_health'
  ));
