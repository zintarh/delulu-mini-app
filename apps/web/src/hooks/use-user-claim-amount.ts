import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { api } from "@/lib/api-client";

/**
 * Hook to get the amount a user claimed for a specific delulu from the backend
 * This is used to display the claimed amount after a user has claimed their winnings
 */
export function useUserClaimAmount(deluluId: string | null) {
  const { address } = useAccount();

  const {
    data: claim,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user-claim", address, deluluId],
    queryFn: async () => {
      if (!address || !deluluId) return null;
      return api.getUserClaimForDelulu(address, deluluId);
    },
    enabled: !!address && !!deluluId,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    claimedAmount: claim?.amount ?? null,
    isLoading,
    error,
  };
}

