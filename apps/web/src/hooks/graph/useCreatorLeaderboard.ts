"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

// NOTE: The subgraph entity is named `CreatorStats`, so the collection field
// is `creatorStatses` (Graph pluralization). We alias it to `creatorStats`
// in the query so the rest of the hook logic can stay simple.
const CREATOR_LEADERBOARD_QUERY = gql`
  query CreatorLeaderboard($first: Int = 20, $skip: Int = 0) {
    creatorStats: creatorStatses(
      first: $first
      skip: $skip
      orderBy: completedGoals
      orderDirection: desc
    ) {
      id
      totalGoals
      completedGoals
      failedGoals
      totalMilestones
      verifiedMilestones
      totalSupportCollected
      createdAt
      user {
        id
        username
      }
    }
  }
`;

export interface CreatorLeaderboardEntry {
  rank: number;
  address: string;
  username: string | null;
  totalGoals: number;
  completedGoals: number;
  totalMilestones: number;
  verifiedMilestones: number;
  totalSupportCollected: number;
}

export function useCreatorLeaderboard(first: number = 20, skip: number = 0) {
  const { data, loading, error, refetch } = useQuery<
    { creatorStats: any[] },
    { first: number; skip: number }
  >(CREATOR_LEADERBOARD_QUERY, {
    variables: { first, skip },
    fetchPolicy: "cache-and-network",
  });

  const entries: CreatorLeaderboardEntry[] = useMemo(() => {
    if (!data?.creatorStats) return [];

    return data.creatorStats.map(
      (s: any, idx: number): CreatorLeaderboardEntry => ({
        rank: idx + 1,
        address: s.id,
        username: s.user?.username ?? null,
        totalGoals: Number(s.totalGoals ?? "0"),
        completedGoals: Number(s.completedGoals ?? "0"),
        totalMilestones: Number(s.totalMilestones ?? "0"),
        verifiedMilestones: Number(s.verifiedMilestones ?? "0"),
        totalSupportCollected: Number(s.totalSupportCollected ?? "0"),
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

