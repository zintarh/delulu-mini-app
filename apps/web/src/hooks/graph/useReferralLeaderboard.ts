"use client";

import { useEffect, useState } from "react";

export type ReferralLeaderboardEntry = {
  rank: number;
  wallet_address: string;
  username: string | null;
  referral_count: number;
  points: number;
};

type ApiResponse = {
  leaderboard: ReferralLeaderboardEntry[];
  hasMore: boolean;
  totalCount: number;
  myEntry: ReferralLeaderboardEntry | null;
};

/** Wallets ranked by successful referrals (verified + joined a campaign or created a Forfeit). */
export function useReferralLeaderboard(page: number, currentUserAddress?: string) {
  const [entries, setEntries] = useState<ReferralLeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [myRankEntry, setMyRankEntry] = useState<ReferralLeaderboardEntry | null>(null);
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
        const res = await fetch(`/api/leaderboard/referrals?${qs}`);
        const json = (await res.json()) as ApiResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Failed to load leaderboard");
        setEntries(json.leaderboard ?? []);
        setHasMore(Boolean(json.hasMore));
        setTotalCount(json.totalCount ?? null);
        setMyRankEntry(json.myEntry ?? null);
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

  return {
    entries,
    hasNextPage: hasMore,
    totalCount,
    myRankEntry,
    isLoading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
  };
}
