"use client";

import { useChainId } from "wagmi";
import { useReadContract } from "wagmi";
import { useMemo } from "react";
import {
  getDeluluContractAddress,
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  CELO_MAINNET_ID,
} from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
}

/** Chain-aware supported tokens - queries contract to verify support */
export function useSupportedTokens() {
  const chainId = useChainId();

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

  // Get the correct contract address for the current chain
  const contractAddress = getDeluluContractAddress(chainId);

  // Query contract to check if each token is supported (for reference, but we always return both)
  const cusdSupported = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "isSupportedToken",
    args: [potentialTokens[0]?.address as `0x${string}`],
    query: { enabled: !!potentialTokens[0]?.address },
  });

  const gTokenSupported = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "isSupportedToken",
    args: [potentialTokens[1]?.address as `0x${string}`],
    query: { enabled: !!potentialTokens[1]?.address },
  });

  // Always return both tokens
  return useMemo(() => {
    return potentialTokens;
  }, [potentialTokens, cusdSupported.data, gTokenSupported.data, chainId]);
}
