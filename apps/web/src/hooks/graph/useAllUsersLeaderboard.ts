"use client";

import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

export interface UserLeaderboardEntry {
  rank: number;
  address: string;
  username: string | null;
  points: number;
  totalStaked: number;
  totalClaimed: number;
  deluluCount: number;
}

type ApiRow = {
  rank: number;
  wallet_address: string;
  points_total: number;
  username: string | null;
};

type ApiResponse = {
  leaderboard: ApiRow[];
  hasMore: boolean;
  totalCount: number;
  myEntry: { rank: number; points_total: number; username: string | null } | null;
  error?: string;
};

/**
 * Global leaderboard: personal delulu points + all community campaign points
 * (same total as home useUserTotalPoints).
 */
export function useAllUsersLeaderboard(page: number = 0, currentUserAddress?: string) {
  const [entries, setEntries] = useState<UserLeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | string | null>(null);
  const [myRankEntry, setMyRankEntry] = useState<{ rank: number; points: number } | null>(
    null,
  );
  const [myApiUsername, setMyApiUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRankLoading, setIsRankLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsRankLoading(true);
    setError(null);

    void (async () => {
      try {
        const qs = new URLSearchParams({ page: String(page) });
        if (currentUserAddress) qs.set("address", currentUserAddress);
        const res = await fetch(`/api/leaderboard/global?${qs}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Failed to load leaderboard");

        setEntries(
          (json.leaderboard ?? []).map((row) => ({
            rank: row.rank,
            address: row.wallet_address,
            username: row.username,
            points: row.points_total,
            totalStaked: 0,
            totalClaimed: 0,
            deluluCount: 0,
          })),
        );
        setHasMore(Boolean(json.hasMore));
        setTotalCount(json.totalCount ?? null);
        setMyRankEntry(
          json.myEntry
            ? { rank: json.myEntry.rank, points: json.myEntry.points_total }
            : null,
        );
        setMyApiUsername(json.myEntry?.username ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load leaderboard"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRankLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, currentUserAddress, reloadToken]);

  const myPageEntry = useMemo(() => {
    if (!currentUserAddress) return null;
    const lc = currentUserAddress.toLowerCase();
    const onPage = entries.find((e) => e.address.toLowerCase() === lc);
    if (onPage) return onPage;
    if (!myRankEntry) return null;
    return {
      rank: myRankEntry.rank,
      address: currentUserAddress,
      username: myApiUsername,
      points: myRankEntry.points,
      totalStaked: 0,
      totalClaimed: 0,
      deluluCount: 0,
    } satisfies UserLeaderboardEntry;
  }, [entries, currentUserAddress, myRankEntry, myApiUsername]);

  return {
    entries,
    isLoading,
    isRankLoading,
    totalCount,
    hasNextPage: hasMore,
    hasPrevPage: page > 0,
    error,
    refetch: () => setReloadToken((t) => t + 1),
    myRankEntry,
    myPageEntry,
  };
}

export { PAGE_SIZE as ALL_USERS_LEADERBOARD_PAGE_SIZE };
