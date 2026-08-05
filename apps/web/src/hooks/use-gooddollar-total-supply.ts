"use client";

import { useReadContracts, useChainId } from "wagmi";
import { formatUnits } from "viem";
import {
  GOODDOLLAR_ADDRESSES,
  CELO_MAINNET_ID,
  getDeluluContractAddress,
  getCommunityMarketV1Address,
  getForfeitMarketAddress,
  getRewardVaultAddress,
} from "@/lib/constant";

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

/** Total G$ held across every contract that stakes/holds it (Delulu, CommunityMarketV1, ForfeitMarket, RewardVault). */
export function useGoodDollarTotalSupply() {
  const chainId = useChainId();
  const isMainnet = chainId === CELO_MAINNET_ID;

  const contracts = [
    getDeluluContractAddress(chainId),
    getCommunityMarketV1Address(chainId),
    getForfeitMarketAddress(chainId),
    getRewardVaultAddress(chainId),
  ].map((account) => ({
    address: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf" as const,
    args: [account] as const,
  }));

  const { data, isLoading, error } = useReadContracts({
    contracts,
    query: { enabled: isMainnet },
  });

  const totalSupply = data
    ? data.reduce((sum, result) => {
        if (result.status !== "success" || result.result === undefined) return sum;
        return (
          sum +
          parseFloat(formatUnits(BigInt(result.result.toString()), ERC20_DECIMALS))
        );
      }, 0)
    : null;

  return { totalSupply, isLoading, error };
}
