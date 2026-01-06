import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useCallback } from "react";
import { queryKeys, fetchUserStakedDelulus, type ApiDelulu } from "@/lib/api/fetchers";

export function useUserStakedDelulus() {
  const { address, isConnected } = useAccount();

  const query = useQuery({
    queryKey: queryKeys.users.stakedDelulus(address ?? ""),
    queryFn: () => fetchUserStakedDelulus(address!),
    enabled: isConnected && !!address,
  });

  // Helper to check if user staked on a specific delulu
  const hasStakedOn = useCallback(
    (deluluId: string) => (query.data ?? []).some((d) => d.id === deluluId),
    [query.data]
  );

  return {
    data: query.data ?? ([] as ApiDelulu[]),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasStakedOn,
  };
}
