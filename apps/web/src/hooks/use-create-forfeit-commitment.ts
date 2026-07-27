"use client";

import { useChainId, usePublicClient } from "wagmi";
import { BaseError, ContractFunctionRevertedError, keccak256, toHex, zeroAddress } from "viem";
import type { PublicClient } from "viem";
import { getForfeitMarketAddress } from "@/lib/constant";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

function extractForfeitErrorName(err: unknown): string | null {
  if (err instanceof BaseError) {
    const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName ?? null;
    }
  }
  return null;
}

function describeForfeitError(errorName: string | null, fallback: string): string {
  switch (errorName) {
    case "StakeBelowMinimum":
      return "That stake amount is below the minimum for this token.";
    case "CharityNotApproved":
      return "This charity isn't approved yet — pick a different destination.";
    case "InvalidInput":
      return "Some of the commitment details aren't valid. Double-check the deadline and amount.";
    case "CommitmentNotFound":
      return "This commitment doesn't exist.";
    case "VerifierAlreadySet":
      return "This commitment already has a verifier assigned.";
    case "InvalidInviteCode":
      return "This invite link is invalid or has already been used.";
    case "VerifierInvitePending":
      return "The invited friend hasn't accepted yet — they need to confirm before this can be resolved.";
    case "TokenNotApproved":
      return "This token isn't supported for forfeits yet.";
    case "EnforcedPause":
      return "Creating new forfeits is temporarily paused. Please try again shortly.";
    case "NotActive":
      return "This commitment isn't active anymore.";
    case "DeadlinePassed":
      return "The deadline for this period has already passed.";
    case "PeriodAlreadyResolved":
      return "This period has already been resolved.";
    case "Unauthorized":
      return "You're not authorized to do that for this commitment.";
    default:
      return fallback;
  }
}

async function awaitMinedSuccess(
  publicClient: PublicClient | undefined,
  txHash: `0x${string}`,
  failureMessage: string,
) {
  if (!publicClient) return;
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 120_000,
    pollingInterval: 1_500,
  });
  if (receipt.status !== "success") throw new Error(failureMessage);
}

/** Matches the DestinationType enum declared in ForfeitMarket.sol. */
export const ForfeitDestinationType = {
  SelfReturn: 0,
  Charity: 1,
  Friend: 2,
  CommunityPool: 3,
} as const;

/** Matches the Cadence enum declared in ForfeitMarket.sol. */
export const ForfeitCadence = {
  Once: 0,
  Daily: 1,
  Weekday: 2,
  Weekly: 3,
  Monthly: 4,
} as const;

const ZERO_HASH = `0x${"00".repeat(32)}` as const;

/**
 * A friend named as verifier only has a username/email at commitment-creation time, not
 * a wallet — so the invite code (and its hash) must exist before the create transaction
 * is sent, since the hash goes on-chain as `verifierInviteCodeHash`. The plaintext code
 * is only ever transmitted once (to the confirm-create API, to build the emailed invite
 * link) and is never persisted server-side — only its hash is, matching what's on-chain.
 */
export function generateVerifierInviteCode(): { code: `0x${string}`; hash: `0x${string}` } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const code = toHex(bytes);
  const hash = keccak256(code);
  return { code, hash };
}

export interface CreateForfeitCommitmentInput {
  token: `0x${string}`;
  stakeAmountWei: bigint;
  destinationType: number;
  /** Required for Charity/Friend, ignored (must be zeroAddress) for SelfReturn/CommunityPool. */
  destinationAddr?: `0x${string}`;
  cadence: number;
  /** Once => 1. Repeat cadences must be >= 1 (no true open-ended commitment on-chain). */
  totalPeriods: number;
  /** Ignored (0) for cadence Once. */
  periodSeconds?: number;
  /** Unix seconds. */
  firstDeadline: number;
  /** Resolved wallet of an existing-user friend-verifier. Omit for self/AI-verify or a not-yet-a-user friend invite. */
  verifier?: `0x${string}`;
  /** Set only for the "friend not yet a user" invite flow — see generateVerifierInviteCode. */
  verifierInviteCodeHash?: `0x${string}`;
}

export function useCreateForfeitCommitment() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error, reset } = useUnifiedWriteContract();

  const createCommitment = async (input: CreateForfeitCommitmentInput) => {
    if (input.stakeAmountWei <= 0n) throw new Error("Stake amount must be greater than 0");
    if (input.totalPeriods < 1) throw new Error("Total periods must be at least 1");
    if (input.cadence !== ForfeitCadence.Once && !input.periodSeconds) {
      throw new Error("Period length is required for a repeating commitment");
    }
    if (input.firstDeadline <= Math.floor(Date.now() / 1000)) {
      throw new Error("Deadline must be in the future");
    }

    return writeContractAsync({
      address: getForfeitMarketAddress(chainId),
      abi: FORFEIT_MARKET_ABI,
      functionName: "createCommitment",
      args: [
        input.token,
        input.stakeAmountWei,
        input.destinationType,
        input.destinationAddr ?? zeroAddress,
        input.cadence,
        BigInt(input.totalPeriods),
        BigInt(input.periodSeconds ?? 0),
        BigInt(input.firstDeadline),
        input.verifier ?? zeroAddress,
        input.verifierInviteCodeHash ?? ZERO_HASH,
      ],
    });
  };

  const createCommitmentAndWait = async (input: CreateForfeitCommitmentInput) => {
    const txHash = await createCommitment(input);
    try {
      await awaitMinedSuccess(publicClient, txHash, "Create transaction failed on-chain");
    } catch (err) {
      if (err instanceof Error && err.message === "Create transaction failed on-chain" && publicClient) {
        // Mined but reverted — re-simulate at the same call to recover the reason.
        try {
          await publicClient.simulateContract({
            address: getForfeitMarketAddress(chainId),
            abi: FORFEIT_MARKET_ABI,
            functionName: "createCommitment",
            args: [
              input.token,
              input.stakeAmountWei,
              input.destinationType,
              input.destinationAddr ?? zeroAddress,
              input.cadence,
              input.totalPeriods,
              BigInt(input.periodSeconds ?? 0),
              BigInt(input.firstDeadline),
              input.verifier ?? zeroAddress,
              input.verifierInviteCodeHash ?? ZERO_HASH,
            ],
          });
        } catch (simErr) {
          throw new Error(describeForfeitError(extractForfeitErrorName(simErr), "Failed to create commitment."));
        }
      }
      throw err;
    }
    return txHash;
  };

  return { createCommitment, createCommitmentAndWait, isPending, error, reset };
}

export function useAcceptForfeitVerifierInvite() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error, reset } = useUnifiedWriteContract();

  const acceptVerifierInvite = async (commitmentId: number, inviteCode: `0x${string}`) => {
    return writeContractAsync({
      address: getForfeitMarketAddress(chainId),
      abi: FORFEIT_MARKET_ABI,
      functionName: "acceptVerifierInvite",
      args: [BigInt(commitmentId), inviteCode],
    });
  };

  const acceptVerifierInviteAndWait = async (commitmentId: number, inviteCode: `0x${string}`) => {
    try {
      const txHash = await acceptVerifierInvite(commitmentId, inviteCode);
      await awaitMinedSuccess(publicClient, txHash, "Accept transaction failed on-chain");
      return txHash;
    } catch (err) {
      const name = extractForfeitErrorName(err);
      if (name) throw new Error(describeForfeitError(name, "Failed to accept this invite."));
      throw err;
    }
  };

  return { acceptVerifierInvite, acceptVerifierInviteAndWait, isPending, error, reset };
}

export function useSubmitForfeitProof() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error, reset } = useUnifiedWriteContract();

  const submitProof = async (commitmentId: number, proofLink: string) => {
    return writeContractAsync({
      address: getForfeitMarketAddress(chainId),
      abi: FORFEIT_MARKET_ABI,
      functionName: "submitProof",
      args: [BigInt(commitmentId), proofLink],
    });
  };

  const submitProofAndWait = async (commitmentId: number, proofLink: string) => {
    try {
      const txHash = await submitProof(commitmentId, proofLink);
      await awaitMinedSuccess(publicClient, txHash, "Submit-proof transaction failed on-chain");
      return txHash;
    } catch (err) {
      const name = extractForfeitErrorName(err);
      if (name) throw new Error(describeForfeitError(name, "Failed to submit proof."));
      throw err;
    }
  };

  return { submitProof, submitProofAndWait, isPending, error, reset };
}

export function useResolveForfeitCommitmentSuccess() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error, reset } = useUnifiedWriteContract();

  const resolveCommitmentSuccess = async (commitmentId: number) => {
    return writeContractAsync({
      address: getForfeitMarketAddress(chainId),
      abi: FORFEIT_MARKET_ABI,
      functionName: "resolveCommitmentSuccess",
      args: [BigInt(commitmentId)],
    });
  };

  const resolveCommitmentSuccessAndWait = async (commitmentId: number) => {
    try {
      const txHash = await resolveCommitmentSuccess(commitmentId);
      await awaitMinedSuccess(publicClient, txHash, "Resolve transaction failed on-chain");
      return txHash;
    } catch (err) {
      const name = extractForfeitErrorName(err);
      if (name) throw new Error(describeForfeitError(name, "Failed to confirm this proof."));
      throw err;
    }
  };

  return { resolveCommitmentSuccess, resolveCommitmentSuccessAndWait, isPending, error, reset };
}

export function useCancelForfeitCommitment() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error, reset } = useUnifiedWriteContract();

  const cancelCommitment = async (commitmentId: number) => {
    return writeContractAsync({
      address: getForfeitMarketAddress(chainId),
      abi: FORFEIT_MARKET_ABI,
      functionName: "cancelCommitment",
      args: [BigInt(commitmentId)],
    });
  };

  const cancelCommitmentAndWait = async (commitmentId: number) => {
    try {
      const txHash = await cancelCommitment(commitmentId);
      await awaitMinedSuccess(publicClient, txHash, "Cancel transaction failed on-chain");
      return txHash;
    } catch (err) {
      const name = extractForfeitErrorName(err);
      if (name) throw new Error(describeForfeitError(name, "Failed to discontinue this forfeit."));
      throw err;
    }
  };

  return { cancelCommitment, cancelCommitmentAndWait, isPending, error, reset };
}
