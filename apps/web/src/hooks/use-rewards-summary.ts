"use client";

import { useQuery } from "@tanstack/react-query";
import type { RewardsSummaryDto } from "@/app/api/rewards/summary/route";

export type RewardsSummary = RewardsSummaryDto;

/**
 * G$ Rewards Engine data for the signed-in wallet (GET /api/rewards/summary).
 * Polls while any reward is still on its way, so a pending row flips to
 * paid (or failed) without a reload.
 */
export function useRewardsSummary(address: `0x${string}` | undefined) {
  const query = useQuery<RewardsSummary>({
    queryKey: ["rewards-summary", address?.toLowerCase()],
    enabled: !!address,
    staleTime: 15_000,
    queryFn: async () => {
      const res = await fetch(`/api/rewards/summary?address=${encodeURIComponent(address!)}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as RewardsSummary & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load rewards");
      return json;
    },
    refetchInterval: (q) => {
      const data = q.state.data;
      return data && (data.totals.pending > 0 || data.history.some((h) => h.status === "pending")) ? 15_000 : false;
    },
  });
  return {
    summary: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
