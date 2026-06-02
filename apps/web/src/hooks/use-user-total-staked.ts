export function useUserTotalStaked(deluluId: number | null) {
  void deluluId;

  return {
    // Legacy stake aggregate is not available on the current contract.
    totalStaked: 0,
    isLoading: false,
    error: null as Error | null,
  };
}

