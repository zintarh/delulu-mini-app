"use client";

import { useMemo } from "react";
import { getSupportedTokens } from "@/lib/constant";

export interface SupportedTokenInfo {
  address: string;
  symbol: string;
  name: string;
}

/** Supported create/tip tokens on Celo mainnet (must also be enabled via setTokenSupport on-chain). */
export function useSupportedTokens(): SupportedTokenInfo[] {
  return useMemo(() => [...getSupportedTokens()], []);
}
