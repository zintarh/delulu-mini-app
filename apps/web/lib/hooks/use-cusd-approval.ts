"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { useCUSDContractAddress, useDeluluContractAddress } from "./use-delulu-contract";
import { parseUnits, formatUnits } from "viem";

/**
 * Hook to check cUSD balance of connected wallet
 */
export function useCUSDBalance() {
  const { address: userAddress } = useAccount();
  const cUSDAddress = useCUSDContractAddress();

  const { data, error, isLoading, refetch } = useReadContract({
    address: cUSDAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  return {
    balance: data as bigint | undefined,
    balanceFormatted: data ? formatUnits(data, 18) : "0",
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to check current cUSD allowance for Delulu contract
 */
export function useCUSDAllowance() {
  const { address: userAddress } = useAccount();
  const cUSDAddress = useCUSDContractAddress();
  const deluluAddress = useDeluluContractAddress();

  const { data, error, isLoading, refetch } = useReadContract({
    address: cUSDAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress ? [userAddress, deluluAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  return {
    allowance: data as bigint | undefined,
    allowanceFormatted: data ? formatUnits(data, 18) : "0",
    error,
    isLoading,
    refetch,
  };
}

/**
 * Hook to approve cUSD spending by Delulu contract
 * @param amount - Amount to approve (in base units, use parseUnits for cUSD)
 * @param onSuccess - Callback when approval is successful
 */
export function useApproveCUSD(onSuccess?: (data: any) => void) {
  const cUSDAddress = useCUSDContractAddress();
  const deluluAddress = useDeluluContractAddress();
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (amount: bigint) => {
    writeContract({
      address: cUSDAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [deluluAddress, amount],
    });
  };

  const approveMax = () => {
    // Approve maximum possible amount (effectively unlimited)
    const maxAmount = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    approve(maxAmount);
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  return {
    approve,
    approveMax,
    hash,
    error,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
  };
}

/**
 * Combined hook to check if approval is needed and provide approval function
 * @param requiredAmount - Amount needed for the transaction (in base units)
 */
export function useCheckAndApproveCUSD(requiredAmount: bigint | undefined) {
  const { allowance, refetch: refetchAllowance } = useCUSDAllowance();
  const approval = useApproveCUSD(() => {
    // Refetch allowance after successful approval
    refetchAllowance();
  });

  const needsApproval = requiredAmount !== undefined && allowance !== undefined && allowance < requiredAmount;
  const hasInfiniteApproval = allowance !== undefined && allowance > parseUnits("1000000", 18); // Consider > 1M as infinite

  return {
    needsApproval,
    hasInfiniteApproval,
    currentAllowance: allowance,
    requiredAmount,
    ...approval,
  };
}

/**
 * Utility function to parse cUSD amount from user input
 * @param value - User input string (e.g., "10.5")
 * @returns BigInt in base units
 */
export function parseCUSD(value: string): bigint {
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

/**
 * Utility function to format cUSD amount for display
 * @param value - Amount in base units
 * @param decimals - Number of decimal places to show
 * @returns Formatted string
 */
export function formatCUSD(value: bigint | undefined, decimals = 2): string {
  if (value === undefined) return "0";
  const formatted = formatUnits(value, 18);
  return Number(formatted).toFixed(decimals);
}

