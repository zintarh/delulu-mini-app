"use client";

import { useQuery } from "@tanstack/react-query";

export type ForfeitActivityItem = {
  id: string;
  commitmentId: string;
  commitmentTitle: string | null;
  periodIndex: number;
  outcome: "success" | "forfeited";
  creatorWallet: string;
  creatorUsername: string | null;
  token: string;
  tokenSymbol: string;
  amount: number | null;
  platformFee: number | null;
  bountyPaid: number | null;
  destinationType: number | null;
  destinationAddr: string | null;
  destinationLabel: string | null;
  txHash: string;
  createdAt: string;
};

export type ForfeitPoolStat = {
  token: string;
  tokenSymbol: string;
  balance: number;
  charityShare: number;
};

export type ForfeitActivityResponse = {
  items: ForfeitActivityItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  pool: ForfeitPoolStat[];
};

export type ForfeitActivityFilters = {
  page: number;
  outcome: string;
};

export const dashboardForfeitActivityKey = (filters: ForfeitActivityFilters) =>
  ["dashboard", "forfeit", "activity", filters] as const;

async function fetchForfeitActivity(
  filters: ForfeitActivityFilters,
): Promise<ForfeitActivityResponse> {
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.outcome && filters.outcome !== "all") {
    params.set("outcome", filters.outcome);
  }

  const res = await fetch(`/api/dashboard/forfeit/activity?${params}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return json as ForfeitActivityResponse;
}

export function useDashboardForfeitActivity(filters: ForfeitActivityFilters) {
  return useQuery({
    queryKey: dashboardForfeitActivityKey(filters),
    queryFn: () => fetchForfeitActivity(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
}
