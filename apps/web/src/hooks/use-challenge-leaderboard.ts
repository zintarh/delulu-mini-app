"use client";

import { useMemo, useState, useEffect } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import {
  transformSubgraphDelulu,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import { sumDeluluEarnedPoints } from "@/lib/delulu-earned-points";
import type { FormattedDelulu } from "@/lib/types";

const CHALLENGE_LEADERBOARD_QUERY = gql`
  query ChallengeLeaderboard(
    $first: Int = 200
    $skip: Int = 0
    $where: Delulu_filter
  ) {
    delulus(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: $where
    ) {
      id
      onChainId
      contentHash
      creatorAddress
      challengeId
      points
      creator {
        id
        username
      }
      milestones(first: 50, orderBy: milestoneId, orderDirection: asc) {
        id
        isVerified
        pointsEarned
      }
    }
  }
`;

export interface LeaderboardEntry {
  deluluId: number;
  creator: string;
  username?: string;
  points: number;
  delulu: FormattedDelulu;
}

export function useChallengeLeaderboard(challengeId: number | null) {
  const [ipfsResolved, setIpfsResolved] = useState(0);

  // Fetch all delulus for this challenge from subgraph
  const { data, loading, error, refetch } = useQuery<
    { delulus: any[] },
    {
      first: number;
      skip: number;
      where: { challengeId?: string };
    }
  >(CHALLENGE_LEADERBOARD_QUERY, {
    variables: {
      first: 200,
      skip: 0,
      where: {
        challengeId: challengeId !== null ? challengeId.toString() : undefined,
      },
    },
    skip: !challengeId,
    fetchPolicy: "cache-and-network",
  });

  // Debug: log raw data coming straight from the subgraph
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // This shows exactly what the subgraph is returning for this challenge
      // independent of any client-side transforms.
      // eslint-disable-next-line no-console
      console.log("[useChallengeLeaderboard] raw subgraph data", {
        challengeId,
        delulus: data?.delulus,
      });
    }
  }, [data, challengeId]);

  // Resolve IPFS content for all delulus in this challenge
  useEffect(() => {
    if (!data?.delulus || data.delulus.length === 0) return;
    const hashes = data.delulus.map((d) => d.contentHash);
    batchResolveIPFS(hashes).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
  }, [data?.delulus]);

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    if (!data?.delulus) return [];

    const transformed = data.delulus
      .map((d) => {
        try {
          const cached = getCachedContent(d.contentHash);
          return transformSubgraphDelulu(d as SubgraphDeluluRaw, cached);
        } catch {
          return null;
        }
      })
      .filter((d): d is FormattedDelulu => d !== null);

    const entries: LeaderboardEntry[] = transformed.map((delulu) => {
      const raw = data.delulus.find(
        (r) => r.id === delulu.onChainId || r.id === String(delulu.id),
      );
      return {
        deluluId: Number(delulu.onChainId ?? delulu.id),
        creator: delulu.creator,
        username: delulu.username,
        points: sumDeluluEarnedPoints(raw?.milestones),
        delulu,
      };
    });

    // Sort by points descending
    return entries.sort((a, b) => b.points - a.points);
  }, [data?.delulus, ipfsResolved]);

  return {
    leaderboard,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
