-- Streak milestones: G$ for N days in a row with a daily-rewarded proof,
-- once per milestone per streak (see evaluateStreakMilestones in
-- apps/web/src/lib/rewards/engine.ts). Only widens the category list.
-- Safe to run more than once.

alter table public.reward_payouts drop constraint if exists reward_payouts_category_check;
alter table public.reward_payouts add constraint reward_payouts_category_check
  check (category in ('daily_proof', 'weekly_consistency', 'campaign_completion', 'goal_completion', 'streak_milestone'));
