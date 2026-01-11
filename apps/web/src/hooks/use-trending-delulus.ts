import { useQuery } from "@tanstack/react-query";
import { queryKeys, fetchTrendingDelulus, type ApiDelulu } from "@/lib/api/fetchers";

export function useTrendingDelulus(limit = 10) {
  const query = useQuery({
    queryKey: queryKeys.delulus.trending(limit),
    queryFn: () => fetchTrendingDelulus(limit),
  });

  return {
    data: query.data ?? ([] as ApiDelulu[]),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
