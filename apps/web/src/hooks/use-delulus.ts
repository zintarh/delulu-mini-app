import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, fetchDelulus, type ApiDelulu } from "@/lib/api/fetchers";

export interface GatekeeperConfig {
  enabled: boolean;
  type: "country";
  value: string;
  label: string;
}

export interface FormattedDelulu {
  id: number;
  onChainId?: string;
  creator: string;
  contentHash: string;
  content?: string;
  username?: string;
  pfpUrl?: string;
  createdAt?: Date;
  gatekeeper?: GatekeeperConfig;
  bgImageUrl?: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalStake: number;
  outcome: boolean;
  isResolved: boolean;
  isCancelled: boolean;
}

// Transform backend API response to FormattedDelulu
function transformApiDelulu(d: ApiDelulu): FormattedDelulu {
  const believerStake = d.totalBelieverStake ?? 0;
  const doubterStake = d.totalDoubterStake ?? 0;

  return {
    // Parse onChainId if it exists and is not empty, otherwise fallback to parsing DB id
    // Note: onChainId should always be present for synced delulus, but may be missing for unsynced ones
    id: (d.onChainId && d.onChainId.trim() !== "") ? parseInt(d.onChainId) : (parseInt(d.id) || 0),
    // Preserve onChainId as string if it exists and is not empty, otherwise undefined
    onChainId: (d.onChainId && d.onChainId.trim() !== "") ? d.onChainId : undefined,
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

export function useDelulus() {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.delulus.list({
      limit: PAGE_SIZE,
      includeResolved: true,
    }),
    queryFn: async ({
      pageParam,
    }): Promise<{ data: FormattedDelulu[]; nextCursor: string | null }> => {
      const response = await fetchDelulus({
        limit: PAGE_SIZE,
        cursor: pageParam,
        includeResolved: true,
      });

      const transformed = response.data
        .filter((d) => !d.isCancelled)
        .map(transformApiDelulu);

      // Deduplicate by onChainId (most reliable unique identifier)
      const seenOnChainIds = new Set<string>();
      const uniqueDelulus = transformed.filter((d) => {
        // Use onChainId as the unique identifier, fallback to id
        const uniqueId = d.onChainId || `db-${d.id}`;
        if (seenOnChainIds.has(uniqueId)) {
          console.warn(
            `Duplicate delulu detected: id=${d.id}, onChainId=${d.onChainId}`
          );
          return false;
        }
        seenOnChainIds.add(uniqueId);
        return true;
      });

      // Backend already sorts by createdAt desc, but ensure consistency
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
    staleTime: 30 * 1000, // 30 seconds for feed freshness
  });

  const allDelulus = query.data?.pages.flatMap((page) => page.data) ?? [];

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
