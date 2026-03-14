"use client";

import { useReadContract, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { GOODDOLLAR_ADDRESSES, CELO_MAINNET_ID } from "@/lib/constant";

const ERC20_TOTAL_SUPPLY_ABI = [
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** G$ token uses 2 decimals on Celo (not 18). */
const G_DOLLAR_DECIMALS = 2;

/** Total G$ in circulation (total supply of GoodDollar token on Celo mainnet). */
export function useGoodDollarTotalSupply() {
  const chainId = useChainId();
  const isMainnet = chainId === CELO_MAINNET_ID;

  const { data: totalSupplyRaw, isLoading, error } = useReadContract({
    address: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    abi: ERC20_TOTAL_SUPPLY_ABI,
    functionName: "totalSupply",
    query: { enabled: isMainnet },
  });

  const totalSupply =
    totalSupplyRaw !== undefined
      ? parseFloat(formatUnits(BigInt(totalSupplyRaw.toString()), G_DOLLAR_DECIMALS))
      : null;

  return { totalSupply, isLoading, error };
}
