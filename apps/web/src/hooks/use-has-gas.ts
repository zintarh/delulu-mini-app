"use client";

import { useBalance } from "wagmi";
import { parseEther } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { CELO_MAINNET_ID } from "@/lib/constant";

/** Minimum CELO balance to cover a typical on-chain transaction fee. */
export const MIN_GAS_CELO = 0.01;
const MIN_GAS_WEI = parseEther(String(MIN_GAS_CELO));

export function useHasGas() {
  const { authenticated, address } = useAuth();
  const enabled = !!authenticated && !!address;

  const { data, isLoading, isFetching, isError } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled, staleTime: 30_000 },
  });

  const balanceKnown = enabled && data != null && !isError;
  const balanceWei = data?.value ?? null;
  /** True only when we have a confirmed balance below the gas threshold. */
  const isLowGas = balanceKnown && balanceWei != null && balanceWei < MIN_GAS_WEI;
  /** True when balance is known and at/above threshold; true while unknown so UI does not false-alarm. */
  const hasGas = !isLowGas;

  return {
    hasGas,
    isLowGas,
    isLoading: enabled && (isLoading || (isFetching && data == null)),
    balanceWei,
    balanceKnown,
  };
}
