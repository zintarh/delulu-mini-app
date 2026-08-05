/** Admin may delete campaigns that have not been funded on-chain yet. */
export function canDeleteDashboardCampaign(status: string): boolean {
  return status !== "active" && status !== "funding" && status !== "ended";
}

/** Live on-chain campaigns (approved or funded) can be ended by the host. */
export function canEndDashboardCampaign(
  status: string,
  onChainChallengeId: number | null | undefined,
): boolean {
  if (!onChainChallengeId) return false;
  return status === "approved" || status === "active";
}

/**
 * Ended, not yet published. Publishing is deliberately a separate, later action
 * from ending — it locks in the winner snapshot at whatever the pool is at that
 * moment, and forfeited stake only accrues as participants reclaim theirs after
 * the campaign ends. Publishing immediately would lock in the pool before
 * anyone's had a chance to claim (and forfeit), defeating that mechanic.
 */
export function canPublishDashboardPayouts(
  status: string,
  onChainChallengeId: number | null | undefined,
  payoutPublishedAt: string | null | undefined,
): boolean {
  if (!onChainChallengeId) return false;
  if (payoutPublishedAt) return false;
  return status === "ended";
}

export const BASE_PROOF_POINTS = 1000;

/**
 * Season reset for the public/admin monthly campaign leaderboard.
 * Ignore proofs before this instant so a prior ended campaign does not dominate
 * the new month. From the next calendar month onward, max(monthStart, epoch)
 * falls back to normal month boundaries.
 *
 * 2026-07-25 00:00:00 UTC — day after the Friday campaign season ended.
 */
export const MONTHLY_CAMPAIGN_LEADERBOARD_EPOCH_UNIX = Math.floor(
  Date.UTC(2026, 6, 25, 0, 0, 0) / 1000,
);

/** Inclusive lower bound for monthly campaign leaderboard queries. */
export function monthlyCampaignLeaderboardSinceUnixSeconds(now = new Date()): number {
  const monthStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0) / 1000,
  );
  return Math.max(monthStart, MONTHLY_CAMPAIGN_LEADERBOARD_EPOCH_UNIX);
}

/**
 * Forfeit campaign: qualify by forfeiting a single commitment worth
 * FORFEIT_CAMPAIGN_MIN_STAKE_WHOLE+ G$ to Charity or Delulu (on-chain
 * CommunityPool) within the window below. Top FORFEIT_CAMPAIGN_TOP_N by total
 * G$ forfeited share the pool.
 *
 * 2026-08-04 00:00:00 UTC start, 2 weeks → 2026-08-18 00:00:00 UTC end.
 */
export const FORFEIT_CAMPAIGN_START_UNIX = Math.floor(
  Date.UTC(2026, 7, 4, 0, 0, 0) / 1000,
);
export const FORFEIT_CAMPAIGN_END_UNIX = Math.floor(
  Date.UTC(2026, 7, 18, 0, 0, 0) / 1000,
);
export const FORFEIT_CAMPAIGN_MIN_STAKE_WHOLE = 1_000;
export const FORFEIT_CAMPAIGN_POOL_USD = 50;
export const FORFEIT_CAMPAIGN_TOP_N = 5;
