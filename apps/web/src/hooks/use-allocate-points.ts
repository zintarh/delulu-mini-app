"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { parseUnits } from "viem";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useAllocatePoints() {
  const chainId = useChainId();
  const {
    writeContract,
    data: hash,
    isPending: isAllocating,
    error: allocateError,
  } = useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const allocatePoints = async (deluluId: number, points: number) => {
    try {
      await writeContract({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "allocatePoints",
        args: [BigInt(deluluId), BigInt(points)],
      });
    } catch (error) {
      console.error("Error allocating points:", error);
      throw error;
    }
  };

  const formatErrorForDisplay = (error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("user rejected") || message.includes("user denied")) {
        return "Transaction was cancelled";
      }
      if (message.includes("insufficient funds")) {
        return "Insufficient funds for transaction";
      }
      if (message.includes("challenge not found")) {
        return "Challenge not found";
      }
      return error.message;
    }
    return "An unexpected error occurred";
  };

  return {
    allocatePoints,
    isAllocating,
    isConfirming,
    isSuccess,
    error: allocateError || confirmError,
    errorMessage: allocateError || confirmError ? formatErrorForDisplay(allocateError || confirmError) : null,
    hash,
  };
}
