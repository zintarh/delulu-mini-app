import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useUserClaims(address: string | undefined) {
  const {
    data: claims,
    isLoading: isLoadingClaims,
    error: claimsError,
  } = useQuery({
    queryKey: ["user-claims", address],
    queryFn: async () => {
      if (!address) return [];
      return api.getUserClaims(address);
    },
    enabled: !!address,
    staleTime: 30 * 1000, // 30 seconds
  });

  const {
    data: totalClaimed,
    isLoading: isLoadingTotal,
    error: totalError,
  } = useQuery({
    queryKey: ["user-total-claimed", address],
    queryFn: async () => {
      if (!address) return 0;
      return api.getTotalClaimed(address);
    },
    enabled: !!address,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    claims: claims || [],
    totalClaimed: totalClaimed || 0,
    isLoading: isLoadingClaims || isLoadingTotal,
    error: claimsError || totalError,
  };
}

