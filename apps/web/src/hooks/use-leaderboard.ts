import { useQuery } from "@tanstack/react-query";
import { queryKeys, fetchLeaderboard, type LeaderboardEntry, type LeaderboardType } from "@/lib/api/fetchers";

export function useLeaderboard(type: LeaderboardType = "stakers", limit = 10) {
  const query = useQuery({
    queryKey: queryKeys.leaderboard(type, limit),
    queryFn: () => fetchLeaderboard(type, limit),
  });

  return {
    data: query.data ?? ([] as LeaderboardEntry[]),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
