"use client";

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import {
  DELULU_CONTRACT_ADDRESS,
  CUSD_CONTRACT_ADDRESS,
} from "@/lib/contracts/config";
import { parseUnits, formatUnits } from "viem";

// Celo Sepolia Chain ID
const CELO_SEPOLIA_CHAIN_ID = 11142220;

export function useCUSDBalanceContract() {
  const { address: userAddress } = useAccount();

  const { data, error, isLoading, refetch } = useReadContract({
    address: CUSD_CONTRACT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    chainId: CELO_SEPOLIA_CHAIN_ID,
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

  const { 
    isLoading: isConfirming, 
    isSuccess,
    error: receiptError,
    status: receiptStatus 
  } = useWaitForTransactionReceipt({
    hash,
    pollingInterval: 2000,
    retryCount: 10,
    timeout: 60000,
  });

  // Log receipt polling status
  console.log("📊 Approval receipt status:", {
    hash,
    isConfirming,
    isSuccess,
    receiptStatus,
    receiptError: receiptError?.message,
  });

  const approve = (amount: bigint) => {
    try {
      console.log("🔄 useApproveCUSD - calling approve with:", {
        tokenAddress: CUSD_CONTRACT_ADDRESS,
        spenderAddress: DELULU_CONTRACT_ADDRESS,
        amount: amount.toString(),
      });

      writeContract({
        address: CUSD_CONTRACT_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [DELULU_CONTRACT_ADDRESS, amount],
      });

      console.log("✅ approve writeContract called successfully");
    } catch (err) {
      console.error("❌ Error in approve:", err);
      throw err;
    }
  };

  const approveMax = () => {
    try {
      const maxAmount = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      console.log("🔄 Approving max amount:", maxAmount.toString());
      approve(maxAmount);
    } catch (err) {
      console.error("❌ Error in approveMax:", err);
      throw err;
    }
  };

  if (isSuccess && onSuccess) {
    onSuccess(hash);
  }

  // Log errors for debugging
  if (error) {
    console.error("❌ useApproveCUSD writeContract error:", error);
  }
  if (receiptError) {
    console.error("❌ useApproveCUSD receipt error:", receiptError);
  }

  // Combine errors - prioritize receipt error if both exist
  const combinedError = receiptError || error;

  return {
    approve,
    approveMax,
    hash,
    error: combinedError,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    receiptStatus,
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
    refetchAllowance,
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
