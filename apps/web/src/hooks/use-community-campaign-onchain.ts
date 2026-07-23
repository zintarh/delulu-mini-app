"use client";

import { useWaitForTransactionReceipt, useChainId, usePublicClient } from "wagmi";
import { decodeErrorResult } from "viem";
import { getCommunityMarketV1Address } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

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
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
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
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
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
