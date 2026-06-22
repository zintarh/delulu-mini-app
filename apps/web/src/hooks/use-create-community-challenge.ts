"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { decodeErrorResult } from "viem";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import {
  campaignDurationSeconds,
  proofIntervalSeconds,
} from "@/lib/community/campaign-on-chain";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useCreateCommunityChallenge() {
  const chainId = useChainId();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const createCommunityChallenge = async (input: {
    contentHash: string;
    durationDays: number;
    proofCadence: "daily" | "weekly";
  }) => {
    const contentHash = input.contentHash.trim();
    if (!contentHash) throw new Error("Content hash is required");

    const duration = campaignDurationSeconds(input.durationDays);
    const interval = proofIntervalSeconds(input.proofCadence);

    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "createCommunityChallenge",
      args: [contentHash, BigInt(duration), BigInt(interval)],
    });
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
    createCommunityChallenge,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}
