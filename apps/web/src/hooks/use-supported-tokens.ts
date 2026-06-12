"use client";

import { useMemo } from "react";
import { getSupportedTokens } from "@/lib/constant";

export interface SupportedTokenInfo {
  address: string;
  symbol: string;
  name: string;
}

/** Supported create/tip tokens (G$ + USDT). */
export function useSupportedTokens(): SupportedTokenInfo[] {
  return useMemo(() => [...getSupportedTokens()], []);
}
