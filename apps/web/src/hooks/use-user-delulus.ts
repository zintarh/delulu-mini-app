import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { queryKeys, fetchDelulus, type ApiDelulu } from "@/lib/api/fetchers";
import type { FormattedDelulu } from "./use-delulus";

// Transform backend API response to FormattedDelulu
function transformApiDelulu(d: ApiDelulu): FormattedDelulu {
  const believerStake = d.totalBelieverStake ?? 0;
  const doubterStake = d.totalDoubterStake ?? 0;

  return {
    id: parseInt(d.onChainId) || parseInt(d.id) || 0,
    onChainId: d.onChainId,
    creator: d.creatorAddress,
    contentHash: d.contentHash,
    content: d.content ?? undefined,
    username: d.creator?.username ?? undefined,
    pfpUrl: d.creator?.pfpUrl ?? undefined,
    createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    bgImageUrl: d.bgImageUrl ?? undefined,
    gatekeeper: d.gatekeeperEnabled
      ? {
          enabled: true,
          type: "country",
          value: d.gatekeeperValue ?? "",
          label: d.gatekeeperLabel ?? "",
        }
      : undefined,
    stakingDeadline: new Date(d.stakingDeadline),
    resolutionDeadline: new Date(d.resolutionDeadline),
    totalBelieverStake: believerStake,
    totalDoubterStake: doubterStake,
    totalStake: believerStake + doubterStake,
    outcome: d.outcome ?? false,
    isResolved: d.isResolved,
    isCancelled: d.isCancelled,
  };
}

const PAGE_SIZE = 10;

type DeluluStatus = "ongoing" | "past";

export function useUserDelulus(status: DeluluStatus = "ongoing") {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["user-delulus", address, status],
    queryFn: async ({
      pageParam,
    }): Promise<{ data: FormattedDelulu[]; nextCursor: string | null }> => {
      if (!address) {
        return { data: [], nextCursor: null };
      }

      const response = await fetchDelulus({
        limit: PAGE_SIZE,
        cursor: pageParam,
        creator: address,
        includeResolved: true, // Get all delulus (resolved and unresolved)
      });

      const transformed = response.data.map(transformApiDelulu);

      // Filter by status
      const filtered = transformed.filter((d) => {
        if (status === "ongoing") {
          // Ongoing: not resolved and not cancelled
          return !d.isResolved && !d.isCancelled;
        } else {
          // Past: resolved or cancelled
          return d.isResolved || d.isCancelled;
        }
      });

      // Deduplicate by onChainId
      const seenOnChainIds = new Set<string>();
      const uniqueDelulus = filtered.filter((d) => {
        const uniqueId = d.onChainId || `db-${d.id}`;
        if (seenOnChainIds.has(uniqueId)) {
          return false;
        }
        seenOnChainIds.add(uniqueId);
        return true;
      });

      // Sort by latest first
      const sorted = uniqueDelulus.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return b.id - a.id;
      });

      return {
        data: sorted,
        nextCursor: response.nextCursor ?? null,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isConnected && !!address,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Flatten all pages
  const allDelulus = query.data?.pages.flatMap((page) => page.data) ?? [];

  // Deduplicate across all pages
  const seenOnChainIds = new Set<string>();
  const deduplicatedDelulus = allDelulus.filter((d) => {
    const uniqueId = d.onChainId || `db-${d.id}`;
    if (seenOnChainIds.has(uniqueId)) {
      return false;
    }
    seenOnChainIds.add(uniqueId);
    return true;
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
  };

  return {
    delulus: deduplicatedDelulus,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch,
  };
}

