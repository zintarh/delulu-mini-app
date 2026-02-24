"use client";

import { useReadContract } from "wagmi";
import { KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";

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

export function useTokenMetadata(tokenAddress: string | undefined) {
  const addr = tokenAddress?.toLowerCase();

  const { data: symbol } = useReadContract({
    address: addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: !!addr },
  });

  const { data: decimals } = useReadContract({
    address: addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!addr },
  });

  const resolvedSymbol = symbol || (addr ? KNOWN_TOKEN_SYMBOLS[addr] : null) || "?";
  const resolvedDecimals = decimals ?? 18;

  return { symbol: resolvedSymbol, decimals: resolvedDecimals };
}
