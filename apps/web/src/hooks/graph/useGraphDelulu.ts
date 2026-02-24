

"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetDeluluByIdDocument,
  type GetDeluluByIdQuery,
  type GetDeluluByIdQueryVariables,
} from "@/generated/graphql";
import {
  transformSubgraphDelulu,
  weiToNumber,
  timestampToDate,
  type SubgraphDeluluRaw,
} from "@/lib/graph/transformers";
import { resolveIPFSContent, getCachedContent } from "@/lib/graph/ipfs-cache";
import type { FormattedDelulu } from "@/lib/types";

export interface GraphStake {
  id: string;
  userAddress: string;
  amount: number;
  side: boolean;
  txHash: string;
  createdAt: Date;
}

export function useGraphDelulu(deluluId: string | number | null) {
  const [ipfsResolved, setIpfsResolved] = useState(0);

  const id = deluluId !== null ? String(deluluId) : "";

  const { data, loading, error, refetch } = useQuery<GetDeluluByIdQuery, GetDeluluByIdQueryVariables>(GetDeluluByIdDocument, {
    variables: { id },
    skip: !id,
    fetchPolicy: "cache-and-network",
  });

  // Resolve IPFS content for this delulu
  useEffect(() => {
    if (!data?.delulu?.contentHash) return;
    resolveIPFSContent(data.delulu.contentHash).then(() => {
      setIpfsResolved((prev) => prev + 1);
    });
  }, [data?.delulu?.contentHash]);

  // Transform subgraph data → FormattedDelulu
  const delulu: FormattedDelulu | null = useMemo(() => {
    if (!data?.delulu) return null;
    const raw = data.delulu as SubgraphDeluluRaw;
    return transformSubgraphDelulu(raw, getCachedContent(raw.contentHash));
  }, [data?.delulu, ipfsResolved]);

  // Transform nested stakes for the leaderboard
  const stakes: GraphStake[] = useMemo(() => {
    if (!data?.delulu?.stakes) return [];
    return data.delulu.stakes.map((s) => ({
      id: s.id,
      userAddress: s.user.id,
      amount: weiToNumber(s.amount),
      side: s.side,
      txHash: s.txHash,
      createdAt: timestampToDate(s.createdAt),
    }));
  }, [data?.delulu?.stakes]);

  return {
    delulu,
    stakes,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
