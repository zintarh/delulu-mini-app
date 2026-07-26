"use client";

import { useChainId, usePublicClient } from "wagmi";
import { keccak256, toHex, zeroAddress } from "viem";
import { getForfeitMarketAddress } from "@/lib/constant";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

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
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  };

  return { createCommitment, createCommitmentAndWait, isPending, error, reset };
}
