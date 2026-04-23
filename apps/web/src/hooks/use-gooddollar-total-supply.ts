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

const ERC20_DECIMALS = 18;

/** Total G$ in circulation (ERC20 totalSupply on the GoodDollar token). */
export function useGoodDollarTotalSupply() {
  const chainId = useChainId();
  const isMainnet = chainId === CELO_MAINNET_ID;

  const { data: supplyRaw, isLoading, error } = useReadContract({
    address: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    abi: ERC20_TOTAL_SUPPLY_ABI,
    functionName: "totalSupply",
    query: { enabled: isMainnet },
  });

  const totalSupply =
    supplyRaw !== undefined
      ? parseFloat(formatUnits(BigInt(supplyRaw.toString()), ERC20_DECIMALS))
      : null;

  return { totalSupply, isLoading, error };
}
