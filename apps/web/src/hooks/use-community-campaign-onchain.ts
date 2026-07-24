"use client";

import { useReadContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { decodeErrorResult } from "viem";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

/**
 * Waits for a receipt and throws if the transaction actually reverted.
 * `publicClient.waitForTransactionReceipt` resolves for *any* mined receipt,
 * success or reverted — several `*AndWait` helpers here used to return
 * normally on a reverted tx, so callers (and the confirm-* API routes that
 * trust them) treated on-chain failures as success.
 */
async function awaitMinedSuccess(
  publicClient: PublicClient | undefined,
  txHash: `0x${string}`,
  failureMessage: string,
) {
  if (!publicClient) return;
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(failureMessage);
}

function formatOnChainError(raw: string): string {
  const msg = raw.toLowerCase();
  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("transaction was cancelled") ||
    msg.includes("request rejected")
  ) return "Transaction cancelled.";
  if (
    msg.includes("insufficient funds") ||
    msg.includes("fee payer balance too low") ||
    msg.includes("not enough celo")
  ) return "Not enough CELO for gas fees.";
  return "Transaction failed. Please try again.";
}

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
    await awaitMinedSuccess(publicClient, txHash, "Join transaction failed on-chain");
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
        errorMessage = formatOnChainError(err.message as string);
      }
    } catch {
      errorMessage = formatOnChainError(error?.message || receiptError?.message || "");
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
    await awaitMinedSuccess(publicClient, txHash, "Proof submission failed on-chain");
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
        errorMessage = formatOnChainError(err.message as string);
      }
    } catch {
      errorMessage = formatOnChainError(error?.message || receiptError?.message || "");
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

export function useSetCommunityPayoutRoot() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const setCommunityPayoutRoot = async (input: {
    challengeId: number | bigint;
    merkleRoot: `0x${string}`;
    totalClaimableWei: bigint;
  }) => {
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "setCommunityPayoutRoot",
      args: [
        BigInt(input.challengeId),
        input.merkleRoot,
        input.totalClaimableWei,
      ],
    });
  };

  const setCommunityPayoutRootAndWait = async (
    input: Parameters<typeof setCommunityPayoutRoot>[0],
  ) => {
    const txHash = await setCommunityPayoutRoot(input);
    await awaitMinedSuccess(publicClient, txHash, "Publishing payouts failed on-chain");
    return txHash;
  };

  return {
    setCommunityPayoutRoot,
    setCommunityPayoutRootAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError: !!error || !!receiptError,
    reset,
  };
}

export function useClaimCommunityCampaignReward() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const claimCommunityCampaignReward = async (input: {
    challengeId: number | bigint;
    amountWei: bigint;
    proof: `0x${string}`[];
  }) => {
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "claimCommunityCampaignReward",
      args: [BigInt(input.challengeId), input.amountWei, input.proof],
    });
  };

  const claimCommunityCampaignRewardAndWait = async (
    input: Parameters<typeof claimCommunityCampaignReward>[0],
  ) => {
    const txHash = await claimCommunityCampaignReward(input);
    if (publicClient) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Claim transaction failed on-chain");
      }
    }
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
          decoded.errorName === "AlreadyClaimed"
            ? "You already claimed this reward."
            : decoded.errorName === "InvalidProof"
              ? "Invalid claim proof."
              : decoded.errorName === "PayoutRootNotSet"
                ? "Payouts are not live yet."
                : decoded.errorName === "NoStakeToClaim"
                  ? "No join stake to reclaim."
                  : decoded.errorName === "CampaignNotEnded"
                    ? "Campaign has not ended yet."
                    : decoded.errorName || "Transaction failed";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = formatOnChainError(err.message as string);
      }
    } catch {
      errorMessage = formatOnChainError(error?.message || receiptError?.message || "");
    }
  }

  return {
    claimCommunityCampaignReward,
    claimCommunityCampaignRewardAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}

export function useClaimCommunityJoinStake() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const claimCommunityJoinStake = async (challengeId: number | bigint) => {
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "claimCommunityJoinStake",
      args: [BigInt(challengeId)],
    });
  };

  const claimCommunityJoinStakeAndWait = async (challengeId: number | bigint) => {
    const txHash = await claimCommunityJoinStake(challengeId);
    if (publicClient) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Stake reclaim transaction failed on-chain");
      }
    }
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
          decoded.errorName === "NoStakeToClaim"
            ? "No join stake to reclaim."
            : decoded.errorName === "CampaignNotEnded"
              ? "Campaign has not ended yet."
              : decoded.errorName === "NotJoined"
                ? "You did not join this campaign."
                : decoded.errorName || "Transaction failed";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = formatOnChainError(err.message as string);
      }
    } catch {
      errorMessage = formatOnChainError(error?.message || receiptError?.message || "");
    }
  }

  return {
    claimCommunityJoinStake,
    claimCommunityJoinStakeAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}

export function useSetCommunityCampaignEconomics() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const setCommunityCampaignEconomics = async (input: {
    challengeId: number | bigint;
    isPaid: boolean;
    joinToken: `0x${string}`;
    joinAmountWei: bigint;
    forfeitPct: number;
  }) => {
    return writeContractAsync({
      address: getCommunityMarketV1Address(chainId),
      abi: COMMUNITY_CAMPAIGN_ABI,
      functionName: "setCommunityCampaignEconomics",
      args: [
        BigInt(input.challengeId),
        input.isPaid,
        input.joinToken,
        input.joinAmountWei,
        input.forfeitPct,
      ],
    });
  };

  const setCommunityCampaignEconomicsAndWait = async (
    input: Parameters<typeof setCommunityCampaignEconomics>[0],
  ) => {
    const txHash = await setCommunityCampaignEconomics(input);
    await awaitMinedSuccess(publicClient, txHash, "Configuring paid economics failed on-chain");
    return txHash;
  };

  return {
    setCommunityCampaignEconomics,
    setCommunityCampaignEconomicsAndWait,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError: !!error || !!receiptError,
    reset,
  };
}

/**
 * Detects economics drift for a single campaign — DB says paid but the
 * on-chain configuration never actually landed (see setCommunityCampaignEconomicsAndWait
 * above; this used to fail silently for 13 of 15 paid campaigns). Only
 * fixable while campaignParticipantCount is still 0 — the contract locks
 * economics permanently once anyone has joined.
 */
export function useCampaignEconomicsStatus(
  challengeId: number | null | undefined,
  dbIsFreeToJoin: boolean | undefined,
  dbJoinAmount: number | null | undefined,
) {
  const chainId = useChainId();
  const dbWantsPaid = dbIsFreeToJoin === false && Number(dbJoinAmount ?? 0) > 0;
  const enabled = challengeId != null && dbWantsPaid;

  const { data: onChainIsPaid, isLoading: isLoadingPaid } = useReadContract({
    address: enabled ? getCommunityMarketV1Address(chainId) : undefined,
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "campaignIsPaid",
    args: challengeId != null ? [BigInt(challengeId)] : undefined,
    query: { enabled },
  });
  const { data: participantCount, isLoading: isLoadingCount } = useReadContract({
    address: enabled ? getCommunityMarketV1Address(chainId) : undefined,
    abi: COMMUNITY_CAMPAIGN_ABI,
    functionName: "campaignParticipantCount",
    args: challengeId != null ? [BigInt(challengeId)] : undefined,
    query: { enabled },
  });

  const isLoading = enabled && (isLoadingPaid || isLoadingCount);
  const isDrifted = enabled && onChainIsPaid === false;
  const isStillFixable = isDrifted && (participantCount as bigint | undefined) === 0n;

  return { isLoading, isDrifted, isStillFixable, participantCount: participantCount as bigint | undefined };
}
