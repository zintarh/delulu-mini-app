"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useJoinChallenge() {
  const chainId = useChainId();

  const {
    writeContract,
    data: hash,
    isPending: isJoining,
    error: joinError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const joinChallenge = async (deluluId: number, challengeId: number) => {
    await writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "joinChallenge",
      args: [BigInt(deluluId), BigInt(challengeId)],
    });
  };

  const formatErrorForDisplay = (error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("user rejected") || message.includes("user denied")) {
        return "Transaction was cancelled";
      }
      if (message.includes("challenge expired")) {
        return "This campaign has already ended";
      }
      if (message.includes("challenge not found")) {
        return "Campaign not found";
      }
      if (message.includes("unauthorized")) {
        return "Only the creator of this delulu can join a campaign";
      }
      return error.message;
    }
    return "An unexpected error occurred";
  };

  return {
    joinChallenge,
    isJoining,
    isConfirming,
    isSuccess,
    error: joinError || confirmError,
    errorMessage:
      joinError || confirmError ? formatErrorForDisplay(joinError || confirmError) : null,
    hash,
  };
}

