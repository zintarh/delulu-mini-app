export function useUserTotalStaked(deluluId: number | null) {
  void deluluId;

  return {
    // Legacy stake aggregate removed in shares-only contract.
    totalStaked: 0,
    isLoading: false,
    error: null as Error | null,
  };
}

