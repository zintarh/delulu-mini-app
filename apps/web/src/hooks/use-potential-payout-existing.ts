/**
 * Hook to get potential payout for an EXISTING stake position (for active markets)
 * This calculates what the user would win if their side wins, based on their current stake
 * without adding the stake to the pool (since it's already there)
 */
export function usePotentialPayoutForExistingStake(deluluId: number | null) {
  void deluluId;

  return {
    // Legacy stake-market preview no longer exists in the shares-only contract.
    potentialPayout: null as number | null,
    isLoading: false,
    error: null as Error | null,
  };
}

