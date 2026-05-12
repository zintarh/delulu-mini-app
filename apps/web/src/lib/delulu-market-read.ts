/**
 * `delulus(uint256)` ABI output: viem/wagmi may decode the Market struct as a **tuple array**
 * or as **named fields**. Calling code must handle both or `id` / `creator` appear missing.
 */
export function normalizeDeluluMarketRead(
  data: unknown,
): Record<string, unknown> | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data)) {
    const m = data;
    return {
      id: m[0],
      creator: m[1],
      token: m[2],
      contentHash: m[3],
      stakingDeadline: m[4],
      resolutionDeadline: m[5],
      totalSupportCollected: m[6],
      totalSupporters: m[7],
      milestoneCount: m[8],
      challengeId: m[9],
      points: m[10],
      isResolved: m[11],
      rewardClaimed: m[12],
    };
  }
  if (typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return undefined;
}
