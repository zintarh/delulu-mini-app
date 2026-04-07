"use client";

import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";

// After subgraph redeployment with totalG + tradeCount fields, switch
// orderBy to totalG for accurate ranking (creatorStake + totalSupportCollected).
// Until then we fetch a larger batch and sort client-side by the combined total.
const DELULU_LEADERBOARD_QUERY = gql`
  query DeluluLeaderboard($first: Int = 50, $skip: Int = 0) {
    delulus(
      first: $first
      skip: $skip
      orderBy: uniqueBuyerCount
      orderDirection: desc
      where: { isCancelled: false }
    ) {
      id
      onChainId
      contentHash
      creatorStake
      totalSupportCollected
      totalG
      shareSupply
      tradeCount
      uniqueBuyerCount
      creator {
        id
        username
      }
    }
  }
`;

export interface DeluluLeaderboardEntry {
  id: string;
  onChainId: string;
  contentHash: string;
  title: string | null;
  creatorAddress: string;
  creatorUsername: string | null;
  /** creatorStake + totalSupportCollected — the true total G$ on this delulu */
  totalG: number;
  creatorStake: number;
  totalSupportCollected: number;
  shareSupply: number;
  tradeCount: number;
  uniqueBuyerCount: number;
}

export function useDeluluLeaderboard(pageSize: number = 10, page: number = 0) {
  const [ipfsResolved, setIpfsResolved] = useState(0);

  // Fetch a generous batch so client-side sort by totalG is accurate.
  // Once totalG is indexed in the subgraph this can be reduced to pageSize+1.
  const fetchSize = Math.max(50, (page + 1) * pageSize + pageSize);

  const { data, loading, error, refetch } = useQuery<
    { delulus: any[] },
    { first: number; skip: number }
  >(DELULU_LEADERBOARD_QUERY, {
    variables: { first: fetchSize, skip: 0 },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  useEffect(() => {
    if (!data?.delulus?.length) return;
    const hashes = data.delulus.map((d) => d.contentHash).filter(Boolean);
    batchResolveIPFS(hashes).then(() => setIpfsResolved((n) => n + 1));
  }, [data?.delulus]);

  const allEntries: DeluluLeaderboardEntry[] = useMemo(() => {
    if (!data?.delulus) return [];

    return data.delulus
      .map((d: any): DeluluLeaderboardEntry => {
        const cached = getCachedContent(d.contentHash);
        const creatorStake = weiToNumber(d.creatorStake);
        const totalSupportCollected = weiToNumber(d.totalSupportCollected);
        return {
          id: d.id,
          onChainId: d.onChainId,
          contentHash: d.contentHash,
          title: cached?.text ?? null,
          creatorAddress: d.creator?.id ?? "",
          creatorUsername: d.creator?.username ?? null,
          totalG: creatorStake + totalSupportCollected,
          creatorStake,
          totalSupportCollected,
          shareSupply: Number(d.shareSupply ?? "0"),
          tradeCount: Number(d.tradeCount ?? "0"),
          uniqueBuyerCount: Number(d.uniqueBuyerCount ?? "0"),
        };
      })
      .sort((a, b) => {
        // Primary: unique buyers descending
        if (b.uniqueBuyerCount !== a.uniqueBuyerCount)
          return b.uniqueBuyerCount - a.uniqueBuyerCount;
        // Tiebreaker: total G$ descending
        return b.totalG - a.totalG;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.delulus, ipfsResolved]);

  const start = page * pageSize;
  const entries = allEntries.slice(start, start + pageSize);
  const hasNextPage = allEntries.length > start + pageSize;

  return {
    entries,
    hasNextPage,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
