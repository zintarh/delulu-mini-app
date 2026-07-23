

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

/**
 * `overrideAddress` bypasses the wagmi-connected account — required for Privy-authenticated
 * users, since wagmi has no Privy connector and `useAccount()` never reports them as connected
 * (see privy-wallet-session-bootstrap.tsx). Callers that already have the user's address from
 * `useAuth()` (which handles all auth providers) should always pass it explicitly.
 */
export function useGraphUserStats(overrideAddress?: string) {
  const { address: connectedAddress, isConnected } = useAccount();
  const address = overrideAddress ?? connectedAddress;
  const userId = address?.toLowerCase() ?? "";
  const skip = overrideAddress ? !userId : !isConnected || !userId;

  const { data, loading, error, refetch } = useQuery<GetUserQuery, GetUserQueryVariables>(GetUserDocument, {
    variables: { id: userId },
    skip,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
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
    isLoading: loading && !data,
    error: error ?? null,
    refetch,
  };
}
