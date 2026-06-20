"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useRefundChallengePool() {
  const chainId = useChainId();
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash });

  const refundChallengePool = async (challengeId: number) => {
    if (!Number.isFinite(challengeId) || challengeId <= 0) {
      throw new Error("Invalid campaign id");
    }
    await writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "refundChallengePool",
      args: [BigInt(challengeId)],
    });
  };

  const formatError = (error: unknown): string => {
    if (!(error instanceof Error)) return "Refund failed";
    const message = error.message.toLowerCase();
    if (message.includes("user rejected") || message.includes("user denied")) {
      return "Transaction cancelled";
    }
    if (message.includes("challengenotclosed")) {
      return "Campaign has not ended yet";
    }
    if (message.includes("challengepoolempty")) {
      return "Pool already withdrawn";
    }
    if (message.includes("challengenotfound")) {
      return "Campaign not found on-chain";
    }
    if (message.includes("ownable") || message.includes("unauthorized")) {
      return "Only the wallet that created this campaign can withdraw";
    }
    return error.message;
  };

  const error = writeError || confirmError;

  return {
    refundChallengePool,
    hash,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error,
    errorMessage: error ? formatError(error) : null,
  };
}
