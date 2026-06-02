export function useTotalClaimedAmount() {
  return {
    // Legacy aggregate claimed view is not available on the current contract.
    totalClaimed: 0,
    isLoading: false,
    error: null as Error | null,
  };
}

