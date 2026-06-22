"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { decodeErrorResult } from "viem";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useAddCommunityCampaignMilestones() {
  const chainId = useChainId();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const addCommunityCampaignMilestones = async (input: {
    challengeId: number | bigint;
    mURIs: string[];
    mDurations: bigint[];
  }) => {
    if (input.mURIs.length === 0) throw new Error("At least one milestone is required");
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "addCommunityCampaignMilestones",
      args: [BigInt(input.challengeId), input.mURIs, input.mDurations],
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
    addCommunityCampaignMilestones,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}
