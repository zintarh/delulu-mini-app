import { useUserClaimableAmount } from "@/hooks/use-user-claimable-amount";

export function useClaimable(deluluId: number | null) {
  const { claimableAmount, isLoading, error } = useUserClaimableAmount(deluluId);

  return {
    isClaimable: claimableAmount > 0,
    claimableAmount,
    isLoading,
    error,
  };
}
