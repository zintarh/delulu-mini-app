"use client";

import { useReadContract } from "wagmi";
import { KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";
import { getTokenDecimals, TOKEN_DECIMALS_BY_ADDRESS } from "@/lib/token-amounts";

const ERC20_ABI = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Every token this app actually supports (G$, USDT, cUSD) has a static
 * symbol/decimals entry already. Only hit the chain for tokens outside
 * that registry — avoids 2 redundant RPC calls per render for the common case.
 */
function isKnownToken(addr: string | undefined): boolean {
  return !!addr && addr in TOKEN_DECIMALS_BY_ADDRESS && addr in KNOWN_TOKEN_SYMBOLS;
}

export function useTokenMetadata(tokenAddress: string | undefined) {
  const addr = tokenAddress?.toLowerCase();
  const known = isKnownToken(addr);

  const { data: symbol } = useReadContract({
    address: addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!addr && !known },
  });

  const { data: decimals } = useReadContract({
    address: addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!addr && !known },
  });

  const resolvedSymbol = symbol || (addr ? KNOWN_TOKEN_SYMBOLS[addr] : null) || "?";
  const resolvedDecimals = decimals ?? getTokenDecimals(addr);

  return { symbol: resolvedSymbol, decimals: resolvedDecimals };
}
