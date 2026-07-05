"use client";

import { useEffect, useState } from "react";

export type MonthlyCampaignLeaderboardEntry = {
  rank: number;
  wallet_address: string;
  points_total: number;
  username: string | null;
};

type ApiResponse = {
  leaderboard: MonthlyCampaignLeaderboardEntry[];
  hasMore: boolean;
  totalCount: number;
};

/** Community-campaign points earned by wallets that joined a campaign this calendar month. */
export function useMonthlyCampaignLeaderboard(page: number, currentUserAddress?: string) {
  const [entries, setEntries] = useState<MonthlyCampaignLeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/leaderboard/monthly-campaigns?page=${page}`);
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Failed to load leaderboard");
        setEntries(json.leaderboard ?? []);
        setHasMore(Boolean(json.hasMore));
        setTotalCount(json.totalCount ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Failed to load leaderboard"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  const myEntry =
    currentUserAddress != null
      ? (entries.find((e) => e.wallet_address.toLowerCase() === currentUserAddress.toLowerCase()) ?? null)
      : null;

  return {
    entries,
    hasNextPage: hasMore,
    totalCount,
    isLoading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
    myPageEntry: myEntry,
  };
}
