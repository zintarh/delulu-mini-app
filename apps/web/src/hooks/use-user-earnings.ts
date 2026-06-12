"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";
import { getTokenSymbol, toUsdAmount } from "@/lib/token-amounts";
import { GOODDOLLAR_ADDRESSES, isGoodDollarToken } from "@/lib/constant";
import { useGraphUserClaims } from "@/hooks/graph/useGraphUserClaims";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";

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
  tokenAddress: string;
  symbol: string;
  amount: number;
  usdAmount: number | null;
}

export function useUserEarnings(address: string | undefined) {
  const { usd: gDollarUsdPrice, isLoading: priceLoading } = useGoodDollarPrice();

  const creatorAddresses = useMemo(() => {
    if (!address) return [] as string[];
    return Array.from(new Set([address, address.toLowerCase()]));
  }, [address]);

  const {
    totalClaimed,
    isLoading: claimsLoading,
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
    const byToken = new Map<string, number>();

    for (const row of data?.delulus ?? []) {
      const token = (row.token ?? GOODDOLLAR_ADDRESSES.mainnet).toLowerCase();
      const support = row.totalSupportCollected
        ? weiToNumber(row.totalSupportCollected, token)
        : 0;
      const stake = row.creatorStake
        ? weiToNumber(row.creatorStake, token)
        : 0;
      const lineTotal = support + stake;
      if (lineTotal > 0) {
        byToken.set(token, (byToken.get(token) ?? 0) + lineTotal);
      }
    }

    if (totalClaimed > 0) {
      const g$ = GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
      byToken.set(g$, (byToken.get(g$) ?? 0) + totalClaimed);
    }

    return Array.from(byToken.entries())
      .filter(([, amount]) => amount > 0)
      .map(([tokenAddress, amount]) => ({
        tokenAddress,
        symbol: getTokenSymbol(tokenAddress),
        amount,
        usdAmount: toUsdAmount(amount, tokenAddress, gDollarUsdPrice),
      }))
      .sort((a, b) => (b.usdAmount ?? b.amount) - (a.usdAmount ?? a.amount));
  }, [data?.delulus, totalClaimed, gDollarUsdPrice]);

  const totalUsd = useMemo(() => {
    if (earningsLines.length === 0) return null;
    let sum = 0;
    for (const line of earningsLines) {
      if (line.usdAmount == null) return null;
      sum += line.usdAmount;
    }
    return sum;
  }, [earningsLines]);

  const needsGPrice = earningsLines.some(
    (line) =>
      line.amount > 0 &&
      isGoodDollarToken(line.tokenAddress) &&
      line.usdAmount == null,
  );

  return {
    earningsLines,
    totalUsd,
    isLoading:
      (supportLoading && !data) || claimsLoading || (needsGPrice && priceLoading),
  };
}
