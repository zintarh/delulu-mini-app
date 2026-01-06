import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    id: parseInt(d.onChainId) || parseInt(d.id) || 0, // Use onChainId first, fallback to DB id
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

export function useDelulus() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.delulus.list({ limit: 100, includeResolved: false }),
    queryFn: async (): Promise<FormattedDelulu[]> => {
      const response = await fetchDelulus({ limit: 100, includeResolved: false });

      const transformed = response.data
        .filter((d) => !d.isCancelled)
        .map(transformApiDelulu);

      // Deduplicate by onChainId (most reliable unique identifier)
      const seenOnChainIds = new Set<string>();
      const uniqueDelulus = transformed.filter((d) => {
        // Use onChainId as the unique identifier, fallback to id
        const uniqueId = d.onChainId || `db-${d.id}`;
        if (seenOnChainIds.has(uniqueId)) {
          console.warn(`Duplicate delulu detected: id=${d.id}, onChainId=${d.onChainId}`);
          return false;
        }
        seenOnChainIds.add(uniqueId);
        return true;
      });

      return uniqueDelulus.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return b.id - a.id;
      });
    },
    staleTime: 30 * 1000, // 30 seconds for feed freshness
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
  };

  return {
    delulus: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}
