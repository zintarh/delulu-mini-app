

"use client";

import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import {
  GetStakesByDeluluDocument,
  type GetStakesByDeluluQuery,
  type GetStakesByDeluluQueryVariables,
} from "@/generated/graphql";
import { weiToNumber } from "@/lib/graph/transformers";

export interface GraphStakeEntry {
  id: string;
  userId: string;
  amount: number;
  txHash: string;
  createdAt: string;
  user?: {
    address: string;
    username?: string;
  };
}

export function useGraphDeluluStakes(deluluId: string | null) {
  const { data, loading, error, refetch } = useQuery<GetStakesByDeluluQuery, GetStakesByDeluluQueryVariables>(
    GetStakesByDeluluDocument,
    {
      variables: { deluluId: deluluId ?? "" },
      skip: !deluluId,
      fetchPolicy: "cache-and-network",
    }
  );

  const stakes: GraphStakeEntry[] = useMemo(() => {
    if (!data?.stakes) return [];
    return data.stakes.map((s) => ({
      id: s.id,
      userId: s.user.id,
      amount: weiToNumber(s.amount),
      txHash: s.txHash,
      createdAt: new Date(Number(s.createdAt) * 1000).toISOString(),
      user: {
        address: s.user.id,
      },
    }));
  }, [data?.stakes]);

  return {
    data: stakes,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
