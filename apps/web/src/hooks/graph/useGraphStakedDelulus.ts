/**
 * useGraphStakedDelulus — Replaces the old `useUserStakedDelulus` hook.
 *
 * For the "Vision" tab: fetches all delulus the connected user has staked on,
 * by querying the user's stakes and extracting unique delulu entities.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { useAccount } from "wagmi";
import {
  GetStakesByUserDocument,
  type GetStakesByUserQuery,
  type GetStakesByUserQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { batchResolveIPFS, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

export function useGraphStakedDelulus() {
  const { address, isConnected } = useAccount();
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const userId = address?.toLowerCase() ?? "";

  const { data, loading, error } = useQuery<GetStakesByUserQuery, GetStakesByUserQueryVariables>(GetStakesByUserDocument, {
    variables: { userId, first: 200 },
    skip: !isConnected || !userId,
    fetchPolicy: "cache-and-network",
  });

  // Debug: Log query results
  useEffect(() => {
    console.log('[useGraphStakedDelulus] Query state:', {
      loading,
      isConnected,
      userId,
      hasData: !!data,
      stakesCount: data?.stakes?.length ?? 0,
      error: error?.message,
      rawData: data,
    });
  }, [data, loading, error, isConnected, userId]);

  // Extract unique delulus from the user's stakes
  const rawDelulus = useMemo(() => {
    if (!data?.stakes) return [];

    const deluluMap = new Map<string, SubgraphDeluluRaw>();
    for (const stake of data.stakes) {
      const d = stake.delulu;
      if (!deluluMap.has(d.id)) {
        deluluMap.set(d.id, d as unknown as SubgraphDeluluRaw);
      }
    }

    return [...deluluMap.values()].map((d) =>
      transformSubgraphDelulu(d, getCachedContent(d.contentHash))
    );
  }, [data?.stakes, ipfsResolved]);

  // Resolve IPFS metadata
  useEffect(() => {
    if (!data?.stakes || data.stakes.length === 0) return;
    const hashes = [
      ...new Set(data.stakes.map((s) => s.delulu.contentHash)),
    ];
    batchResolveIPFS(hashes).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
  }, [data?.stakes]);

  // Sort by latest first (most recent stake), filter out cancelled
  const delulus = useMemo(() => {
    return rawDelulus
      .filter((d) => !d.isCancelled)
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return b.id - a.id;
      });
  }, [rawDelulus]);

  return {
    data: delulus,
    isLoading: loading,
    error: error ?? null,
  };
}
