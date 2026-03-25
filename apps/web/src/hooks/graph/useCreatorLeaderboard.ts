"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";

// Goldsky subgraph exposes the list as creatorStats_collection (not creatorStats).
// Alias to creatorStats so the rest of the hook stays unchanged.
const CREATOR_LEADERBOARD_QUERY = gql`
  query CreatorLeaderboard($first: Int = 20, $skip: Int = 0) {
    creatorStats: creatorStats_collection(
      first: $first
      skip: $skip
      orderBy: completedGoals
      orderDirection: desc
    ) {
      id
      totalGoals
      totalMilestones
      totalSupportCollected
      user {
        id
        username
        deluluPoints
      }
    }
  }
`;

export interface CreatorLeaderboardEntry {
  rank: number;
  address: string;
  username: string | null;
  totalGoals: number;
  totalMilestones: number;
  totalSupportCollected: number;
  points: number;
}

export function useCreatorLeaderboard(first: number = 20, skip: number = 0) {
  const { data, loading, error, refetch } = useQuery<
    { creatorStats: any[] },
    { first: number; skip: number }
  >(CREATOR_LEADERBOARD_QUERY, {
    variables: { first, skip },
    // Keep a responsive UI by showing cached results first,
    // then updating from the network.
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const entries: CreatorLeaderboardEntry[] = useMemo(() => {
    if (!data?.creatorStats) return [];

    return data.creatorStats.map(
      (s: any, idx: number): CreatorLeaderboardEntry => ({
        rank: idx + 1,
        address: s.id,
        username: s.user?.username ?? null,
        totalGoals: Number(s.totalGoals ?? "0"),
        totalMilestones: Number(s.totalMilestones ?? "0"),
        totalSupportCollected: weiToNumber(s.totalSupportCollected),
        points: Number(s.user?.deluluPoints ?? "0"),
      })
    );
  }, [data?.creatorStats]);

  return {
    entries,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}

