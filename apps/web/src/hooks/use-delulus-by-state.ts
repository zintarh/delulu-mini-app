import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { queryKeys, fetchDelulusByState, type ApiDelulu, type DeluluState } from "@/lib/api/fetchers";
import { api } from "@/lib/api-client";

export function useDelulusByState(
  state: DeluluState,
  options?: { limit?: number }
) {
  const queryClient = useQueryClient();
  const [allData, setAllData] = useState<ApiDelulu[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.delulus.byState(state, { limit: options?.limit }),
    queryFn: async () => {
      const res = await fetchDelulusByState(state, { limit: options?.limit });
      setAllData(res.data);
      setNextCursor(res.nextCursor);
      return res;
    },
  });

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const res = await api.getDelulusByState(state, {
        limit: options?.limit,
        cursor: nextCursor,
      });
      setAllData((prev) => [...prev, ...res.data]);
      setNextCursor(res.nextCursor);
    } catch (err) {
      console.error("Failed to load more:", err);
    }
  }, [state, nextCursor, options?.limit]);

  const refetch = useCallback(() => {
    setAllData([]);
    setNextCursor(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.delulus.byState(state, { limit: options?.limit }) });
  }, [queryClient, state, options?.limit]);

  return {
    data: allData.length > 0 ? allData : (query.data?.data ?? []),
    isLoading: query.isLoading,
    error: query.error,
    hasMore: !!nextCursor,
    loadMore,
    refetch,
  };
}
