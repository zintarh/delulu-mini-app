-- Enforce notification.type at the DB level so a bad string can't silently
-- slip in outside the app-level NotificationType union (src/lib/notifications.ts).
-- Run this in the Supabase SQL editor.

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'milestone_due',
    'delulu_ending',
    'stake',
    'like',
    'comment',
    'tip',
    'system',
    'campaign_milestone_due',
    'campaign_ending',
    'campaign_proof_submitted'
  ));
