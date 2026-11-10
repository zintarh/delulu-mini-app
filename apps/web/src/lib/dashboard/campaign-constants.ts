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
 * Campaigns whose join stake is below this many G$ award REDUCED_PROOF_POINTS
 * per milestone instead of BASE_PROOF_POINTS — free-to-join campaigns included,
 * since their join amount is 0. Mirrors CommunityMarketV1's
 * LOW_STAKE_JOIN_THRESHOLD (1000 ether) and REDUCED_PROOF_POINTS (100).
 */
export const LOW_STAKE_JOIN_THRESHOLD_WHOLE = 1_000;
export const REDUCED_PROOF_POINTS = 100;

/** Points awarded per completed milestone for a campaign with this join amount (whole G$). */
export function pointsPerMilestoneForJoinAmount(joinAmount: number): number {
  return joinAmount >= LOW_STAKE_JOIN_THRESHOLD_WHOLE ? BASE_PROOF_POINTS : REDUCED_PROOF_POINTS;
}

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
 * Points per kept forfeit day, tiered by stake — mirrors forfeitProofPoints in
 * apps/delulu-subgraph/src/forfeit-market.ts (which is what actually credits
 * them). A word-only stake (0) is the low tier. Thresholds are raw 18-decimal
 * amounts, compared the same way the subgraph does.
 */
export const FORFEIT_PROOF_POINTS_LOW = 100;
const FORFEIT_LOW_STAKE_THRESHOLD = BigInt("1000000000000000000000");
const FORFEIT_HIGH_STAKE_THRESHOLD = BigInt("50000000000000000000000");

export function forfeitProofPointsForStake(stakeAmount: string | bigint | null | undefined): number {
  let stake = BigInt(0);
  try {
    stake = BigInt(stakeAmount ?? 0);
  } catch {
    // Unparseable → treat as no stake.
  }
  if (stake >= FORFEIT_HIGH_STAKE_THRESHOLD) return 5_000;
  if (stake >= FORFEIT_LOW_STAKE_THRESHOLD) return BASE_PROOF_POINTS;
  return FORFEIT_PROOF_POINTS_LOW;
}
