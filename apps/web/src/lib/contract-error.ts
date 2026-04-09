/**
 * Centralized handling of Delulu contract revert errors.
 * Uses viem's decodeErrorResult when revert data is available, plus a
 * friendly-message map, so the UI can show one consistent error modal
 * without many ifs.
 *
 * @see https://viem.sh/docs/contract/decodeErrorResult
 * @see https://wagmi.sh/react/guides/error-handling
 */

import { decodeErrorResult } from "viem";
import type { Abi } from "viem";
import { DELULU_ABI } from "@/lib/abi";

/** User-facing error for the feedback modal */
export interface ContractErrorDisplay {
  title: string;
  message: string;
}

/** Map contract error names to friendly title + message */
const DELULU_ERROR_MESSAGES: Record<string, ContractErrorDisplay> = {
  Unauthorized: { title: "Not allowed", message: "You're not authorized for this action." },
  DeluluNotFound: { title: "Not found", message: "This delulu doesn't exist." },
  ChallengeNotFound: { title: "Challenge not found", message: "The challenge could not be found." },
  ChallengeExpired: { title: "Too late", message: "This challenge has expired." },
  ChallengeNotClosed: { title: "Challenge still open", message: "Wait for the challenge to close." },
  MilestoneNotFound: { title: "Step not found", message: "This step doesn't exist or was removed." },
  MilestoneAlreadyCompleted: { title: "Already done", message: "This step is already verified." },
  MilestoneExpired: { title: "Too late", message: "The deadline for this step has passed." },
  MilestoneCannotBeDeleted: { title: "Can't delete", message: "Step was submitted, verified, or past due." },
  MilestonesCannotBeReset: { title: "Can't reset", message: "One or more steps were already submitted." },
  ProfileRequired: { title: "Profile required", message: "Set a username first." },
  UsernameTaken: { title: "Username taken", message: "This username is already in use." },
  InvalidUsername: { title: "Invalid username", message: "Username must be 3–16 characters." },
  TooManyMilestones: { title: "Too many steps", message: "Maximum steps limit reached." },
  InvalidDeadlines: { title: "Invalid dates", message: "Dates are invalid or exceed the resolution deadline." },
  AlreadyInitialized: { title: "Already set", message: "Already initialized." },
  AlreadyClaimed: { title: "Already claimed", message: "You've already claimed." },
  AlreadySettled: { title: "Already settled", message: "This delulu is already settled." },
  NoPointsAllocated: { title: "No points", message: "No points have been allocated." },
  ClaimPeriodExpired: { title: "Claim period ended", message: "The claim window has closed." },
  InsufficientSweepBalance: { title: "Insufficient balance", message: "Not enough balance to sweep." },
  NotResolved: { title: "Not resolved", message: "The delulu is not resolved yet." },
  StakeTooSmall: { title: "Amount too small", message: "Minimum stake not met." },
  StakingIsClosed: { title: "Staking closed", message: "Staking is closed for this delulu." },
  EnforcedPause: { title: "Paused", message: "Contract is paused." },
  ExpectedPause: { title: "Not paused", message: "Contract is not paused." },
  ReentrancyGuardReentrantCall: { title: "Rejected", message: "Reentrant call blocked." },
  SafeERC20FailedOperation: { title: "Token transfer failed", message: "The token transfer failed." },
};

const DEFAULT_DISPLAY: ContractErrorDisplay = {
  title: "Transaction failed",
  message: "Something went wrong. Please try again.",
};

/**
 * Extracts revert data from a wagmi/viem error (e.g. from useWriteContract).
 * Tries error.cause (viem wraps in BaseError), then error.data.
 */
function getRevertData(error: unknown): `0x${string}` | null {
  if (!error || typeof error !== "object") return null;
  const err = error as Record<string, unknown>;
  // viem ContractFunctionRevertedError / BaseError often has cause with data
  const cause = err.cause as Record<string, unknown> | undefined;
  if (cause?.data && typeof cause.data === "string" && cause.data.startsWith("0x")) {
    return cause.data as `0x${string}`;
  }
  if (err.data && typeof err.data === "string" && err.data.startsWith("0x")) {
    return err.data as `0x${string}`;
  }
  return null;
}

/**
 * Tries to parse a contract error name from the error message (e.g. "Unauthorized" in "ContractFunctionRevertedError: Unauthorized").
 */
function parseErrorNameFromMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) {
    const m = error.message;
    // Match "ErrorName" or "... ErrorName)" or "reverted with reason: ErrorName"
    const match = m.match(/(?:reverted with reason|revert|Error):\s*(\w+)/i)
      ?? m.match(/\b(Unauthorized|DeluluNotFound|MilestoneNotFound|MilestoneExpired|MilestoneAlreadyCompleted|MilestoneCannotBeDeleted|StakingIsClosed|StakeTooSmall|InvalidDeadlines|TooManyMilestones|AlreadyClaimed|ChallengeExpired|ChallengeNotClosed|NotResolved|ProfileRequired|UsernameTaken|InvalidUsername|MilestonesCannotBeReset)\b/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Returns true if the error is a gas/fee error (user has no CELO).
 * Use this to show GetGasModal instead of the generic error modal.
 */
export function isInsufficientGasError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  return (
    /insufficient funds/i.test(msg) ||
    /intrinsic gas too low/i.test(msg) ||
    /gas required exceeds allowance/i.test(msg) ||
    /out of gas/i.test(msg) ||
    /fee payer balance too low/i.test(msg)
  );
}

/**
 * Turns a contract/write error into a single user-friendly title and message.
 * Use this for the error modal so you don't need many ifs per error type.
 */
export function getContractErrorDisplay(
  error: unknown,
  abi: Abi = DELULU_ABI as Abi
): ContractErrorDisplay {
  if (!error) return DEFAULT_DISPLAY;

  const data = getRevertData(error);
  if (data) {
    try {
      const { errorName } = decodeErrorResult({ abi, data });
      const display = DELULU_ERROR_MESSAGES[errorName as string];
      if (display) return display;
      return { title: "Transaction failed", message: errorName ?? "Contract reverted." };
    } catch {
      // decodeErrorResult failed, fall through to message parsing
    }
  }

  const nameFromMessage = parseErrorNameFromMessage(error);
  if (nameFromMessage && DELULU_ERROR_MESSAGES[nameFromMessage]) {
    return DELULU_ERROR_MESSAGES[nameFromMessage];
  }

  if (error instanceof Error && error.message) {
    const msg = error.message.trim();
    if (msg.length > 0 && msg.length < 200) {
      return { title: "Transaction failed", message: msg };
    }
  }

  return DEFAULT_DISPLAY;
}
