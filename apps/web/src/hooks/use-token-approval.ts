"use client";

import { useWaitForTransactionReceipt, useReadContract, useChainId } from "wagmi";
import { parseUnits } from "viem";
import { useState } from "react";
import { getDeluluContractAddress } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

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

/** Per-market token approval. Pass the market's token address. */
export function useTokenApproval(tokenAddress: string | undefined) {
  const { address } = useAuth();
  const chainId = useChainId();
  const token = tokenAddress as `0x${string}` | undefined;
  const { writeContractAsync } = useUnifiedWriteContract();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash });

  const contractAddress = getDeluluContractAddress(chainId);

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token ? [address, contractAddress] : undefined,
    query: { enabled: !!token && !!address },
  });

  const approve = async (amount: number) => {
    if (!token) throw new Error("Token address not available");
    if (!isFinite(amount) || isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

    const amountWei = parseUnits((amount * 1.1).toString(), 18);

    setIsPending(true);
    try {
      const txHash = await writeContractAsync({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, amountWei],
      });
      setHash(txHash);
    } finally {
      setIsPending(false);
    }
  };

  const needsApproval = (amount: number): boolean => {
    if (!amount || isNaN(amount) || amount <= 0) return false;
    if (!allowance || !token) return true;
    try {
      return allowance < parseUnits(amount.toString(), 18);
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
