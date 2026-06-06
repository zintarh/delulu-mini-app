"use client";

import { useMemo } from "react";
import { getSupportedTokens, USDT_ADDRESSES } from "@/lib/constant";
import { useIsMiniPay } from "@/hooks/use-is-minipay";

export interface SupportedTokenInfo {
  address: string;
  symbol: string;
  name: string;
}

/**
 * Supported create/tip tokens.
 * Inside MiniPay: USDT only.
 * Outside MiniPay: G$ + USDT.
 */
export function useSupportedTokens(): SupportedTokenInfo[] {
  const inMiniPay = useIsMiniPay();
  return useMemo(() => {
    const all = getSupportedTokens();
    if (inMiniPay) {
      return all.filter(
        (t) => t.address.toLowerCase() === USDT_ADDRESSES.mainnet.toLowerCase(),
      );
    }
    return [...all];
  }, [inMiniPay]);
}

/** Default token address for the current environment. */
export function useDefaultToken(): string {
  const inMiniPay = useIsMiniPay();
  return inMiniPay ? USDT_ADDRESSES.mainnet : "";
}
