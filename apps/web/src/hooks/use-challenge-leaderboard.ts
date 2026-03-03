"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetDelulusDocument,
  type GetDelulusQuery,
  type GetDelulusQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

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
    GetDelulusQuery,
    GetDelulusQueryVariables
  >(GetDelulusDocument, {
    variables: {
      first: 200,
      skip: 0,
      where: {
        challengeId: challengeId !== null ? challengeId.toString() : undefined,
      },
      orderBy: "points",
      orderDirection: "desc",
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

    const entries: LeaderboardEntry[] = transformed.map((delulu) => ({
      deluluId: Number(delulu.onChainId ?? delulu.id),
      creator: delulu.creator,
      username: delulu.username,
      points: Number((data.delulus.find((raw) => raw.id === delulu.onChainId || raw.id === String(delulu.id)) as any)?.points ?? "0"),
      delulu,
    }));

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
