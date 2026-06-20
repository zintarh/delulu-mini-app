"use client";

import { useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { decodeErrorResult } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI_WITH_COMMUNITY } from "@/lib/abi/delulu-with-community";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useJoinCommunityCampaignOnChain() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const joinCommunityCampaign = async (challengeId: number | bigint) => {
    return writeContractAsync({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI_WITH_COMMUNITY,
      functionName: "joinCommunityCampaign",
      args: [BigInt(challengeId)],
    });
  };

  const joinCommunityCampaignAndWait = async (challengeId: number | bigint) => {
    const txHash = await joinCommunityCampaign(challengeId);
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  };

  const isError = !!error || !!receiptError;
  let errorMessage: string | null = null;
  if (error || receiptError) {
    try {
      const err = error || receiptError;
      if (err && typeof err === "object" && "data" in err) {
        const decoded = decodeErrorResult({
          abi: DELULU_ABI_WITH_COMMUNITY,
          data: err.data as `0x${string}`,
        });
        errorMessage =
          decoded.args?.[0]?.toString() || decoded.errorName || "Transaction failed";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = err.message as string;
      }
    } catch {
      errorMessage = error?.message || receiptError?.message || "Transaction failed";
    }
  }

  return {
    joinCommunityCampaign,
    joinCommunityCampaignAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}

export function useSubmitCommunityProofOnChain() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const submitCommunityProof = async (
    challengeId: number | bigint,
    proofLink: string,
  ) => {
    const link = proofLink.trim();
    if (!link) throw new Error("Proof link is required");
    return writeContractAsync({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI_WITH_COMMUNITY,
      functionName: "submitCommunityProof",
      args: [BigInt(challengeId), link, true],
    });
  };

  const submitCommunityProofAndWait = async (
    challengeId: number | bigint,
    proofLink: string,
  ) => {
    const txHash = await submitCommunityProof(challengeId, proofLink);
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  };

  const isError = !!error || !!receiptError;
  let errorMessage: string | null = null;
  if (error || receiptError) {
    try {
      const err = error || receiptError;
      if (err && typeof err === "object" && "data" in err) {
        const decoded = decodeErrorResult({
          abi: DELULU_ABI_WITH_COMMUNITY,
          data: err.data as `0x${string}`,
        });
        errorMessage =
          decoded.args?.[0]?.toString() || decoded.errorName || "Transaction failed";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = err.message as string;
      }
    } catch {
      errorMessage = error?.message || receiptError?.message || "Transaction failed";
    }
  }

  return {
    submitCommunityProof,
    submitCommunityProofAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}

export function useEndCommunityChallenge() {
  const chainId = useChainId();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const endCommunityChallenge = async (challengeId: number | bigint) => {
    return writeContractAsync({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI_WITH_COMMUNITY,
      functionName: "endCommunityChallenge",
      args: [BigInt(challengeId)],
    });
  };

  const isError = !!error || !!receiptError;
  let errorMessage: string | null = null;
  if (error || receiptError) {
    try {
      const err = error || receiptError;
      if (err && typeof err === "object" && "message" in err) {
        errorMessage = err.message as string;
      }
    } catch {
      errorMessage = error?.message || receiptError?.message || "Transaction failed";
    }
  }

  return {
    endCommunityChallenge,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}
