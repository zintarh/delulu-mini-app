"use client";

import { useEffect, useState } from "react";

export type ForfeitStakedEntryStatus = "active" | "failed";
export type ForfeitStakedDestinationKind = "self" | "charity" | "friend" | "delulu";

export type ForfeitStakedLeaderboardEntry = {
  rank: number;
  commitment_id: number;
  wallet_address: string;
  username: string | null;
  staked_amount: number;
  status: ForfeitStakedEntryStatus;
  destination_kind: ForfeitStakedDestinationKind;
  destination_label: string;
  /** Friend's @username, or a shortened address if they have no username — null for non-friend destinations. */
  destination_name: string | null;
  duration_seconds: number;
};

type ApiResponse = {
  leaderboard: ForfeitStakedLeaderboardEntry[];
  hasMore: boolean;
  totalCount: number;
  myEntry: ForfeitStakedLeaderboardEntry | null;
};

/** G$ Forfeit commitments (20,000+ G$ stake) that are active or already forfeited. */
export function useForfeitStakedLeaderboard(page: number, currentUserAddress?: string) {
  const [entries, setEntries] = useState<ForfeitStakedLeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [myRankEntry, setMyRankEntry] = useState<ForfeitStakedLeaderboardEntry | null>(null);
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
        const res = await fetch(`/api/leaderboard/forfeit-staked?${qs}`);
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

  const myPageEntry =
    currentUserAddress != null
      ? (entries.find((e) => e.wallet_address.toLowerCase() === currentUserAddress.toLowerCase()) ?? null)
      : null;

  return {
    entries,
    hasNextPage: hasMore,
    totalCount,
    myRankEntry,
    isLoading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
    myPageEntry,
  };
}
