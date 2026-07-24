"use client";

import { useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { weiToNumber } from "@/lib/graph/transformers";

const CLAIMS_BY_ADDRESSES_QUERY = gql`
  query ClaimsTotalsByAddresses($ids: [ID!]!) {
    users(where: { id_in: $ids }, first: 1000) {
      id
      claims(first: 200) {
        id
        amount
      }
    }
  }
`;

/** Batched total-claimed (G$) lookup for a page of leaderboard wallet addresses. */
export function useClaimsTotalsByAddresses(addresses: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(addresses.map((a) => a.toLowerCase()))).sort(),
    [addresses],
  );

  const { data, loading } = useQuery<{ users: { id: string; claims: { amount: string }[] }[] }>(
    CLAIMS_BY_ADDRESSES_QUERY,
    {
      variables: { ids },
      skip: ids.length === 0,
      fetchPolicy: "cache-first",
    },
  );

  const totalsByAddress: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const user of data?.users ?? []) {
      map[user.id.toLowerCase()] = user.claims.reduce(
        (sum, c) => sum + weiToNumber(c.amount),
        0,
      );
    }
    return map;
  }, [data?.users]);

  return { totalsByAddress, isLoading: loading };
}
