"use client";

import { useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { decodeErrorResult } from "viem";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
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
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
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
          abi: COMMUNITY_CAMPAIGN_ABI,
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

export function useSubmitCommunityMilestoneProofOnChain() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const submitCommunityCampaignMilestoneProof = async (
    challengeId: number | bigint,
    milestoneId: number | bigint,
    proofLink: string,
  ) => {
    const link = proofLink.trim();
    if (!link) throw new Error("Proof link is required");
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "submitCommunityCampaignMilestoneProof",
      args: [BigInt(challengeId), BigInt(milestoneId), link],
    });
  };

  const submitCommunityCampaignMilestoneProofAndWait = async (
    challengeId: number | bigint,
    milestoneId: number | bigint,
    proofLink: string,
  ) => {
    const txHash = await submitCommunityCampaignMilestoneProof(
      challengeId,
      milestoneId,
      proofLink,
    );
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
          abi: COMMUNITY_CAMPAIGN_ABI,
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
    submitCommunityCampaignMilestoneProof,
    submitCommunityCampaignMilestoneProofAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}

/** @deprecated Use useSubmitCommunityMilestoneProofOnChain */
export function useSubmitCommunityProofOnChain() {
  return useSubmitCommunityMilestoneProofOnChain();
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
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
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
