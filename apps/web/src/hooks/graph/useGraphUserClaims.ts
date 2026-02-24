
"use client";

import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetClaimsByUserDocument,
  type GetClaimsByUserQuery,
  type GetClaimsByUserQueryVariables,
} from "@/generated/graphql";
import { weiToNumber } from "@/lib/graph/transformers";

export interface GraphClaim {
  id: string;
  amount: number;
  txHash: string;
  createdAt: string;
  deluluId: string;
  deluluOnChainId: string;
  deluluContentHash: string;
}

export function useGraphUserClaims(address: string | undefined) {
  const userId = address?.toLowerCase() ?? "";

  const { data, loading, error } = useQuery<GetClaimsByUserQuery, GetClaimsByUserQueryVariables>(GetClaimsByUserDocument, {
    variables: { userId },
    skip: !userId,
    fetchPolicy: "cache-and-network",
  });

  const claims: GraphClaim[] = useMemo(() => {
    if (!data?.claims) return [];
    return data.claims.map((c) => ({
      id: c.id,
      amount: weiToNumber(c.amount),
      txHash: c.txHash,
      createdAt: new Date(Number(c.createdAt) * 1000).toISOString(),
      deluluId: c.delulu.id,
      deluluOnChainId: c.delulu.onChainId,
      deluluContentHash: c.delulu.contentHash,
    }));
  }, [data?.claims]);

  const totalClaimed = useMemo(() => {
    return claims.reduce((sum, c) => sum + c.amount, 0);
  }, [claims]);

  return {
    claims,
    totalClaimed,
    isLoading: loading,
    error: error ?? null,
  };
}
