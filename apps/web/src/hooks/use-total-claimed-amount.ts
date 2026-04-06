export function useTotalClaimedAmount() {
  return {
    // Legacy aggregate claimed view was removed in the shares-only contract.
    totalClaimed: 0,
    isLoading: false,
    error: null as Error | null,
  };
}

