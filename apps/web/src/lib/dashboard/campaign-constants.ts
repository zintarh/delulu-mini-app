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
