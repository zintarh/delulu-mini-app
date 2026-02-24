

"use client";

import { useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { useAccount } from "wagmi";
import {
  GetUserDocument,
  type GetUserQuery,
  type GetUserQueryVariables,
} from "@/generated/graphql";
import { weiToNumber } from "@/lib/graph/transformers";

export interface UserStats {
  totalStaked: number;
  totalClaimed: number;
  activeStakes: number;
  totalDelulus: number;
  totalBets: number;
}

const defaultStats: UserStats = {
  totalStaked: 0,
  totalClaimed: 0,
  activeStakes: 0,
  totalDelulus: 0,
  totalBets: 0,
};

export function useGraphUserStats() {
  const { address, isConnected } = useAccount();
  const userId = address?.toLowerCase() ?? "";

  const { data, loading, error, refetch } = useQuery<GetUserQuery, GetUserQueryVariables>(GetUserDocument, {
    variables: { id: userId },
    skip: !isConnected || !userId,
    fetchPolicy: "cache-and-network",
  });

  const stats: UserStats = useMemo(() => {
    if (!data?.user) return defaultStats;

    const user = data.user;

    const totalStaked = weiToNumber(user.totalStaked);

    const totalClaimed = user.claims.reduce(
      (sum, c) => sum + weiToNumber(c.amount),
      0
    );

    const totalDelulus = user.delulus.length;

    const totalBets = user.stakes.length;

    const activeStakes = user.stakes.filter(
      (s) => !s.delulu.isResolved && !s.delulu.isCancelled
    ).length;

    return {
      totalStaked,
      totalClaimed,
      activeStakes,
      totalDelulus,
      totalBets,
    };
  }, [data?.user]);

  return {
    ...stats,
    isLoading: loading,
    error: error ?? null,
    refetch,
  };
}
