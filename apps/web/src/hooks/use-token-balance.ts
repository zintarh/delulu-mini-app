"use client";

import { useAccount, useBalance } from "wagmi";
import { getAddress } from "viem";
import { CELO_MAINNET_ID } from "@/lib/constant";

export function useTokenBalance(tokenAddress: string | undefined) {
  const { address, chainId } = useAccount();

  const isMainnet = chainId === CELO_MAINNET_ID;

  const normalizedTokenAddress = tokenAddress
    ? getAddress(tokenAddress)
    : undefined;

  const { data: balance, isLoading, error } = useBalance({
    address,
    token: normalizedTokenAddress as `0x${string}` | undefined,
    chainId: CELO_MAINNET_ID,
    query: {
      enabled: !!normalizedTokenAddress && !!address && isMainnet,
    },
  });


  return {
    balance,
    formatted: balance?.formatted ?? "0",
    isLoading,
    error,
  };
}
