import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { queryKeys, fetchUserStats, type ApiStats } from "@/lib/api/fetchers";

const defaultStats: ApiStats = {
  totalStaked: 0,
  totalClaimed: 0,
  activeStakes: 0,
  totalDelulus: 0,
  totalBets: 0,
};

export function useUserStats() {
  const { address, isConnected } = useAccount();

  const query = useQuery({
    queryKey: queryKeys.users.stats(address ?? ""),
    queryFn: () => fetchUserStats(address!),
    enabled: isConnected && !!address,
    placeholderData: defaultStats,
  });

  return {
    ...(query.data ?? defaultStats),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
