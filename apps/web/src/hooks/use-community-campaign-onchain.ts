"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { decodeErrorResult } from "viem";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI_WITH_COMMUNITY } from "@/lib/abi/delulu-with-community";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

const publicClient = createPublicClient({ chain: celo, transport: http() });

async function waitForHash(hash: `0x${string}`) {
  await publicClient.waitForTransactionReceipt({ hash });
}

export function useJoinCommunityCampaignOnChain() {
  const chainId = useChainId();
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
    const hash = await joinCommunityCampaign(challengeId);
    await waitForHash(hash);
    return hash;
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
    const hash = await submitCommunityProof(challengeId, proofLink);
    await waitForHash(hash);
    return hash;
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
