"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";
import { getTokenSymbol } from "@/lib/token-amounts";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useGraphUserClaims } from "@/hooks/graph/useGraphUserClaims";

const GET_USER_SUPPORT_TOTALS = gql`
  query GetUserSupportTotals($creatorAddresses: [String!]) {
    delulus(
      where: { creatorAddress_in: $creatorAddresses }
      first: 1000
    ) {
      totalSupportCollected
      creatorStake
      token
    }
  }
`;

interface SupportDeluluRow {
  totalSupportCollected?: string | null;
  creatorStake?: string | null;
  token?: string | null;
}

export interface EarningsLine {
  symbol: string;
  amount: number;
}

export function useUserEarnings(address: string | undefined) {
  const creatorAddresses = useMemo(() => {
    if (!address) return [] as string[];
    return Array.from(new Set([address, address.toLowerCase()]));
  }, [address]);

  const {
    totalClaimed,
    isLoading: claimsLoading,
    claims,
  } = useGraphUserClaims(address);

  const { data, loading: supportLoading } = useQuery<{
    delulus: SupportDeluluRow[];
  }>(GET_USER_SUPPORT_TOTALS, {
    variables: { creatorAddresses },
    skip: !address,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const earningsLines = useMemo(() => {
    const bySymbol = new Map<string, number>();

    for (const row of data?.delulus ?? []) {
      const token = row.token ?? undefined;
      const symbol = getTokenSymbol(token);
      const support = row.totalSupportCollected
        ? weiToNumber(row.totalSupportCollected, token ?? undefined)
        : 0;
      const stake = row.creatorStake
        ? weiToNumber(row.creatorStake, token ?? undefined)
        : 0;
      const lineTotal = support + stake;
      if (lineTotal > 0) {
        bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + lineTotal);
      }
    }

    if (totalClaimed > 0) {
      const claimSymbol = getTokenSymbol(GOODDOLLAR_ADDRESSES.mainnet);
      bySymbol.set(claimSymbol, (bySymbol.get(claimSymbol) ?? 0) + totalClaimed);
    }

    return Array.from(bySymbol.entries())
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([symbol, amount]) => ({ symbol, amount }) satisfies EarningsLine);
  }, [data?.delulus, totalClaimed]);

  return {
    earningsLines,
    isLoading: (supportLoading && !data) || claimsLoading,
  };
}
