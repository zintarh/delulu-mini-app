/** ~10 years — keeps community prize pools escrowed until Phase 3 payout upgrade. */
export const COMMUNITY_CAMPAIGN_DURATION_SECONDS = 315_360_000;

export const CAMPAIGN_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "funding",
  "active",
  "ended",
  "rejected",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Admin may delete campaigns that have not been funded on-chain yet. */
export function canDeleteDashboardCampaign(status: string): boolean {
  return status !== "active" && status !== "funding" && status !== "ended";
}

export const BASE_PROOF_POINTS = 1000;
export const EARLY_SUBMIT_BONUS = 0;
export const STREAK_BONUS_PER_DAY = 0;
