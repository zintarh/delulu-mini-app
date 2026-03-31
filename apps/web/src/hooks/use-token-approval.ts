"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, useChainId } from "wagmi";
import { parseUnits } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";

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
  const { address } = useAccount();
  const chainId = useChainId();
  const token = tokenAddress as `0x${string}` | undefined;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const contractAddress = getDeluluContractAddress(chainId);

  const { data: allowance, refetch: refetchAllowance, isLoading: isLoadingAllowance } = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && token ? [address, contractAddress] : undefined,
    query: { enabled: !!token && !!address },
  });

  const approve = async (amount: number) => {
    if (!token) {
      throw new Error("Token address not available");
    }
    if (!isFinite(amount) || isNaN(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }

    const bufferMultiplier = 1.1;
    const amountWithBuffer = amount * bufferMultiplier;
    const amountWei = parseUnits(amountWithBuffer.toString(), 18);

    writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      chainId,
      args: [contractAddress, amountWei],
    });
  };

  const needsApproval = (amount: number): boolean => {
    // No approval needed when not staking anything
    if (!amount || isNaN(amount) || amount <= 0) return false;
    if (!allowance || !token) return true;

    try {
      const amountWei = parseUnits(amount.toString(), 18);
      return allowance < amountWei;
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
    error: error || receiptError,
    refetchAllowance,
    isLoadingAllowance,
  };
}
