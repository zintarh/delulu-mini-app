"use client";

import { useReadContract, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { GOODDOLLAR_ADDRESSES, CELO_MAINNET_ID, getDeluluContractAddress } from "@/lib/constant";

const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_DECIMALS = 18;

/** Total G$ held by the Delulu contract (all staked + bonding curve reserves). */
export function useGoodDollarTotalSupply() {
  const chainId = useChainId();
  const isMainnet = chainId === CELO_MAINNET_ID;
  const deluluContract = getDeluluContractAddress(chainId);

  const { data: balanceRaw, isLoading, error } = useReadContract({
    address: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [deluluContract],
    query: { enabled: isMainnet },
  });

  const totalSupply =
    balanceRaw !== undefined
      ? parseFloat(formatUnits(BigInt(balanceRaw.toString()), ERC20_DECIMALS))
      : null;

  return { totalSupply, isLoading, error };
}
