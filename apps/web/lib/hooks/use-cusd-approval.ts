"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useBalance,
} from "wagmi";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import {
  DELULU_CONTRACT_ADDRESS,
  CUSD_CONTRACT_ADDRESS,
} from "@/lib/contracts/config";
import { parseUnits, formatUnits } from "viem";
import { sepolia, mainnet } from "viem/chains";

export function useCUSDBalance() {
  const { address } = useAccount();

  const { data, error, isLoading, refetch } = useBalance({
    address: address,
    chainId: sepolia.id,
    // token: CUSD_CONTRACT_ADDRESS,
    query: {
      enabled: !!address,
    },
  });


  console.log("data", data);

  return {
    balance: data?.value,
    balanceFormatted: data?.formatted || "0",
    error,
    isLoading,
    refetch,
  };

}

export function useCUSDAllowance() {
  const { address: userAddress } = useAccount();

  const { data, error, isLoading, refetch } = useReadContract({
    address: CUSD_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: userAddress ? [userAddress, DELULU_CONTRACT_ADDRESS] : undefined,
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
  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = (amount: bigint) => {
    writeContract({
      address: CUSD_CONTRACT_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [DELULU_CONTRACT_ADDRESS, amount],
    });
  };

  const approveMax = () => {
    // Approve maximum possible amount (effectively unlimited)
    const maxAmount = BigInt(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
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

  const needsApproval =
    requiredAmount !== undefined &&
    allowance !== undefined &&
    allowance < requiredAmount;
  const hasInfiniteApproval =
    allowance !== undefined && allowance > parseUnits("1000000", 18); // Consider > 1M as infinite

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
    return BigInt(0);
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
