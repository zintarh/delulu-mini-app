export function usePotentialPayout(
  deluluId: number | null,
  amount: number | null,
  isBeliever: boolean | null
) {
  void deluluId;
  void amount;
  void isBeliever;

  return {
    // Legacy stake-market preview is not available on the current contract.
    potentialPayout: null as number | null,
    isLoading: false,
    error: null as Error | null,
  };
}

