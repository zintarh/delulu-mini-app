export function usePotentialPayout(
  deluluId: number | null,
  amount: number | null,
  isBeliever: boolean | null
) {
  void deluluId;
  void amount;
  void isBeliever;

  return {
    // Legacy stake-market preview no longer exists in the shares-only contract.
    potentialPayout: null as number | null,
    isLoading: false,
    error: null as Error | null,
  };
}

