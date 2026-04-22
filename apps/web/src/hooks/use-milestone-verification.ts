"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useMilestoneVerification() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const verifyMilestone = (
    deluluId: number,
    milestoneId: number,
    points: number
  ) => {
    if (points < 0 || !Number.isFinite(points)) {
      throw new Error("Invalid points");
    }
    writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "verifyMilestone",
      args: [BigInt(deluluId), BigInt(milestoneId), BigInt(Math.floor(points))],
    });
  };

  const rejectMilestone = (
    deluluId: number,
    milestoneId: number,
    reason: string
  ) => {
    const r = reason.trim() || "Rejected by verifier";
    writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "rejectMilestone",
      args: [BigInt(deluluId), BigInt(milestoneId), r],
    });
  };

  return {
    verifyMilestone,
    rejectMilestone,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error ?? receiptError,
    reset,
  };
}
