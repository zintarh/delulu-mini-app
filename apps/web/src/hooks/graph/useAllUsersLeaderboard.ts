"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";

const PAGE_SIZE = 10;

// Keep this query minimal — only fields confirmed available on the User entity.
// Nested delulus just fetch id so we can get a count without ordering by
// fields that may not be indexed in nested context.
const ALL_USERS_QUERY = gql`
  query AllUsersLeaderboard($first: Int!, $skip: Int!) {
    users(
      first: $first
      skip: $skip
      orderBy: deluluPoints
      orderDirection: desc
    ) {
      id
      username
      deluluPoints
      totalStaked
      delulus(first: 100) {
        id
        uniqueBuyerCount
      }
    }
  }
`;

// Fetches up to 1000 users with points for count + rank calculation.
const ALL_USERS_RANK_QUERY = gql`
  query AllUsersRank {
    users(first: 1000, orderBy: deluluPoints, orderDirection: desc) {
      id
      deluluPoints
    }
  }
`;

export interface UserLeaderboardEntry {
  rank: number;
  address: string;
  username: string | null;
  points: number;
  totalStaked: number;
  totalUniqueBuyers: number;
  deluluCount: number;
}

export function useAllUsersLeaderboard(page: number = 0, currentUserAddress?: string) {
  const { data, loading, error, refetch } = useQuery<{ users: any[] }>(
    ALL_USERS_QUERY,
    {
      variables: { first: PAGE_SIZE, skip: page * PAGE_SIZE },
      fetchPolicy: "cache-and-network",
      onError: (err) => {
        console.error("[AllUsersLeaderboard] query error:", err.message, err.graphQLErrors, err.networkError);
      },
    }
  );

  // Fetches up to 1000 users sorted by points — used for total count + rank lookup.
  const { data: rankData, loading: rankLoading } = useQuery<{
    users: { id: string; deluluPoints: string }[];
  }>(ALL_USERS_RANK_QUERY, {
    fetchPolicy: "cache-and-network",
    onError: (err) => {
      console.error("[AllUsersRank] query error:", err.message);
    },
  });

  const entries: UserLeaderboardEntry[] = useMemo(() => {
    if (!data?.users) return [];
    return data.users.map((u: any, i: number): UserLeaderboardEntry => {
      const delulus: any[] = u.delulus ?? [];
      const totalUniqueBuyers = delulus.reduce(
        (sum: number, d: any) => sum + Number(d.uniqueBuyerCount ?? 0),
        0
      );
      return {
        rank: page * PAGE_SIZE + i + 1,
        address: u.id,
        username: u.username ?? null,
        points: Number(u.deluluPoints ?? "0"),
        totalStaked: weiToNumber(u.totalStaked),
        totalUniqueBuyers,
        deluluCount: delulus.length,
      };
    });
  }, [data?.users, page]);

  const allRankedUsers = rankData?.users ?? [];
  const rawTotal = allRankedUsers.length;
  const totalCount = rawTotal === 1000 ? "1000+" : rawTotal || null;
  const hasNextPage = (data?.users.length ?? 0) >= PAGE_SIZE;

  // Find the current user's rank and points from the full sorted list.
  const myRankEntry = useMemo(() => {
    if (!currentUserAddress || allRankedUsers.length === 0) return null;
    const lc = currentUserAddress.toLowerCase();
    const idx = allRankedUsers.findIndex((u) => u.id.toLowerCase() === lc);
    if (idx === -1) return null;
    return { rank: idx + 1, points: Number(allRankedUsers[idx].deluluPoints ?? "0") };
  }, [allRankedUsers, currentUserAddress]);

  // Find current user's full entry from the current page (for username/UB).
  const myPageEntry = useMemo(() => {
    if (!currentUserAddress) return null;
    const lc = currentUserAddress.toLowerCase();
    return entries.find((e) => e.address.toLowerCase() === lc) ?? null;
  }, [entries, currentUserAddress]);

  return {
    entries,
    isLoading: loading,
    isRankLoading: rankLoading,
    totalCount,
    hasNextPage,
    hasPrevPage: page > 0,
    error: error ?? null,
    refetch,
    myRankEntry,
    myPageEntry,
  };
}
