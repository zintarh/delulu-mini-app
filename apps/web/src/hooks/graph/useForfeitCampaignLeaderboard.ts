"use client";

import { useEffect, useState } from "react";

export type ForfeitCampaignLeaderboardEntry = {
  rank: number;
  wallet_address: string;
  forfeited_amount: number;
  qualifying_count: number;
  username: string | null;
};

type ApiResponse = {
  leaderboard: ForfeitCampaignLeaderboardEntry[];
  hasMore: boolean;
  totalCount: number;
  myEntry: { rank: number; forfeited_amount: number } | null;
  campaignStart: string;
  campaignEnd: string;
};

/** G$ forfeited to Charity/Delulu this campaign, from qualifying (10,000+ G$ stake) forfeitures. */
export function useForfeitCampaignLeaderboard(page: number, currentUserAddress?: string) {
  const [entries, setEntries] = useState<ForfeitCampaignLeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [myRankEntry, setMyRankEntry] = useState<{ rank: number; forfeitedAmount: number } | null>(
    null,
  );
  const [campaignEnd, setCampaignEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const qs = new URLSearchParams({ page: String(page) });
        if (currentUserAddress) qs.set("address", currentUserAddress);
        const res = await fetch(`/api/leaderboard/forfeit-campaign?${qs}`);
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Failed to load leaderboard");
        setEntries(json.leaderboard ?? []);
        setHasMore(Boolean(json.hasMore));
        setTotalCount(json.totalCount ?? null);
        setCampaignEnd(json.campaignEnd ?? null);
        setMyRankEntry(
          json.myEntry
            ? { rank: json.myEntry.rank, forfeitedAmount: json.myEntry.forfeited_amount }
            : null,
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Failed to load leaderboard"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, currentUserAddress, reloadToken]);

  const myPageEntry =
    currentUserAddress != null
      ? (entries.find((e) => e.wallet_address.toLowerCase() === currentUserAddress.toLowerCase()) ?? null)
      : null;

  return {
    entries,
    hasNextPage: hasMore,
    totalCount,
    myRankEntry,
    campaignEnd,
    isLoading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
    myPageEntry,
  };
}
