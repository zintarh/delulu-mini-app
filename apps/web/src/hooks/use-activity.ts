import { useQuery } from "@tanstack/react-query";
import { queryKeys, fetchActivity, type ActivityItem } from "@/lib/api/fetchers";

export function useActivity(options?: { address?: string; limit?: number }) {
  const query = useQuery({
    queryKey: queryKeys.activity(options),
    queryFn: () => fetchActivity(options),
  });

  return {
    data: query.data ?? ([] as ActivityItem[]),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
