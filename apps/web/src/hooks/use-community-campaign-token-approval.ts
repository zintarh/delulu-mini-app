"use client";

import { useWaitForTransactionReceipt, useReadContract, useChainId, usePublicClient } from "wagmi";
import { useState } from "react";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useTokenMetadata } from "@/hooks/use-token-metadata";
import { parseTokenAmount } from "@/lib/token-amounts";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { resolveJoinTokenAddress } from "@/lib/community/join-token";

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** Approve CommunityMarketV1 to pull join stake (G$ or ERC-20). */
export function useCommunityCampaignTokenApproval(joinTokenSymbol?: string | null) {
  const { address } = useAuth();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const joinTokenAddress = resolveJoinTokenAddress(joinTokenSymbol);
  const erc20Token =
    joinTokenAddress === "0x0000000000000000000000000000000000000000"
      ? (GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`)
      : joinTokenAddress;
  const { decimals } = useTokenMetadata(erc20Token);
  const { writeContractAsync } = useUnifiedWriteContract();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash });

  const spender = getCommunityMarketV1Address(chainId);

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } =
    useReadContract({
      address: erc20Token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: address && erc20Token ? [address, spender] : undefined,
      query: { enabled: !!erc20Token && !!address },
    });

  const approve = async (amount: number) => {
    if (!erc20Token) throw new Error("Token address not available");
    if (!isFinite(amount) || isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

    const amountWei = parseTokenAmount(amount * 1.1, erc20Token, decimals);

    setIsPending(true);
    try {
      const txHash = await writeContractAsync({
        address: erc20Token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, amountWei],
      });
      setHash(txHash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
      await refetchAllowance();
    } finally {
      setIsPending(false);
    }
  };

  const needsApproval = (amount: number): boolean => {
    if (!amount || isNaN(amount) || amount <= 0) return false;
    if (!allowance || !erc20Token) return true;
    try {
      return allowance < parseTokenAmount(amount, erc20Token, decimals);
    } catch {
      return true;
    }
  };

  return {
    approve,
    needsApproval,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: receiptError,
    refetchAllowance,
    isLoadingAllowance,
  };
}
