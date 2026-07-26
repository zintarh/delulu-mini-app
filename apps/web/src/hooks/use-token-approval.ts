"use client";

import { useWaitForTransactionReceipt, useReadContract, useChainId, usePublicClient } from "wagmi";
import { useState } from "react";
import { maxUint256 } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useTokenMetadata } from "@/hooks/use-token-metadata";
import { parseTokenAmount } from "@/lib/token-amounts";

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

/**
 * Per-market token approval. Pass the market's token address, and — critically —
 * the spender that actually needs to pull the tokens (the contract calling
 * safeTransferFrom). Defaults to the personal Delulu-v3 goals contract only for
 * backward compatibility with call sites that genuinely target it; any other
 * market (ForfeitMarket, CommunityMarketV1, ...) must pass its own address
 * explicitly, or this checks/approves allowance for the wrong contract entirely —
 * the approval "succeeds" but the actual market's transferFrom then reverts on
 * insufficient allowance, since nothing was ever approved for it.
 */
export function useTokenApproval(tokenAddress: string | undefined, spenderAddress?: string) {
  const { address } = useAuth();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const token = tokenAddress as `0x${string}` | undefined;
  const { decimals } = useTokenMetadata(tokenAddress);
  const { writeContractAsync } = useUnifiedWriteContract();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const contractAddress = (spenderAddress as `0x${string}` | undefined) ?? getDeluluContractAddress(chainId);

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token ? [address, contractAddress] : undefined,
    query: { enabled: !!token && !!address },
  });

  // Approves the max allowance once, rather than the exact amount, so a
  // returning creator (e.g. running multiple campaigns) never has to pay for
  // or wait on a second approval tx — `needsApproval` will already be false
  // next time regardless of the new amount.
  const approve = async (amount: number) => {
    if (!token) throw new Error("Token address not available");
    if (!isFinite(amount) || isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

    setIsPending(true);
    try {
      const txHash = await writeContractAsync({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, maxUint256],
      });
      setHash(txHash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      await refetchAllowance();
    } finally {
      setIsPending(false);
    }
  };

  const needsApproval = (amount: number): boolean => {
    if (!amount || isNaN(amount) || amount <= 0) return false;
    if (!allowance || !token) return true;
    try {
      return allowance < parseTokenAmount(amount, token, decimals);
    } catch {
      return true;
    }
  };

  return {
    approve,
    needsApproval,
    tokenAddress: token,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: receiptError,
    refetchAllowance,
    isLoadingAllowance,
  };
}
