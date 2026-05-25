"use client";

import { useMemo } from "react";
import { CUSD_ADDRESSES, GOODDOLLAR_ADDRESSES } from "@/lib/constant";

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
}

/** Chain-aware supported tokens - queries contract to verify support */
export function useSupportedTokens() {
  // Always return both tokens with mainnet addresses
  const potentialTokens = useMemo(
    () => [
      {
        address: CUSD_ADDRESSES.mainnet,
        symbol: "USDm",
        name: "Celo Dollar",
      },
      {
        address: GOODDOLLAR_ADDRESSES.mainnet,
        symbol: "G$",
        name: "GoodDollar",
      },
    ],
    []
  );

  // Both tokens are supported on mainnet; skip RPC on mount (was 2 extra reads per page).
  return useMemo(() => potentialTokens, [potentialTokens]);
}
