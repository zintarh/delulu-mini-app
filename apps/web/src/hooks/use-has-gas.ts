"use client";

import { useBalance } from "wagmi";
import { parseEther } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { CELO_MAINNET_ID } from "@/lib/constant";

/** Minimum CELO balance to cover a typical on-chain transaction fee. */
const MIN_GAS_WEI = parseEther("0.01");

export function useHasGas() {
  const { authenticated, address } = useAuth();
  const enabled = !!authenticated && !!address;

  const { data, isLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled, staleTime: 30_000 },
  });

  return {
    hasGas: (data?.value ?? 0n) >= MIN_GAS_WEI,
    isLoading: enabled && isLoading,
  };
}
