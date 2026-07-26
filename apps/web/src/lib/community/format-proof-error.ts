/**
 * Turns raw camera / upload / API / wallet / contract failures into short,
 * user-readable copy for the live-camera (and screenshot) proof flows.
 */

import { BaseError, ContractFunctionRevertedError, decodeErrorResult } from "viem";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import { isInsufficientGasError } from "@/lib/contract-error";

export type ProofErrorKind =
  | "camera"
  | "upload"
  | "ai"
  | "wallet"
  | "network"
  | "validation"
  | "unknown";

export interface ProofErrorDisplay {
  title: string;
  message: string;
  kind: ProofErrorKind;
}

const COMMUNITY_PROOF_REVERTS: Record<string, ProofErrorDisplay> = {
  AlreadyCompleted: {
    title: "Already submitted",
    message: "You already submitted proof for this day.",
    kind: "validation",
  },
  ProofAfterDeadline: {
    title: "Deadline passed",
    message: "The deadline for this day has passed, so proof can't be submitted.",
    kind: "validation",
  },
  ProofBeforeStart: {
    title: "Not open yet",
    message: "This day isn't open for proof yet. Check back when it starts.",
    kind: "validation",
  },
  NotJoined: {
    title: "Not joined",
    message: "Join this campaign before submitting proof.",
    kind: "validation",
  },
  InvalidProof: {
    title: "Proof rejected",
    message: "Your proof was rejected on-chain. Record again showing the activity clearly.",
    kind: "ai",
  },
  MilestoneNotFound: {
    title: "Day not found",
    message: "This day wasn't found. Refresh the page and try again.",
    kind: "validation",
  },
  CampaignNotFound: {
    title: "Campaign not found",
    message: "This campaign wasn't found on-chain. Refresh and try again.",
    kind: "validation",
  },
  AlreadyEnded: {
    title: "Campaign ended",
    message: "This campaign has already ended.",
    kind: "validation",
  },
  CampaignNotEnded: {
    title: "Still running",
    message: "This campaign is still running.",
    kind: "validation",
  },
  Unauthorized: {
    title: "Not allowed",
    message: "You're not allowed to do that for this campaign.",
    kind: "validation",
  },
  InvalidInput: {
    title: "Invalid proof",
    message: "Something about this submission was invalid. Record again and try uploading.",
    kind: "validation",
  },
};

const API_MESSAGE_MAP: Array<{ test: RegExp; display: ProofErrorDisplay }> = [
  {
    test: /^db unavailable$/i,
    display: {
      title: "Temporarily unavailable",
      message: "Something went wrong on our side. Please try again in a moment.",
      kind: "network",
    },
  },
  {
    test: /ai service not configured/i,
    display: {
      title: "Review unavailable",
      message: "Proof review is temporarily unavailable. Please try again later.",
      kind: "ai",
    },
  },
  {
    test: /image fetch failed/i,
    display: {
      title: "Couldn't load frames",
      message: "We couldn't load your recording frames. Try uploading again.",
      kind: "upload",
    },
  },
  {
    test: /verification failed/i,
    display: {
      title: "Review failed",
      message: "Proof review failed. Check your connection and try again.",
      kind: "ai",
    },
  },
  {
    test: /walletaddress is required/i,
    display: {
      title: "Wallet needed",
      message: "Connect your wallet to submit proof.",
      kind: "wallet",
    },
  },
  {
    test: /proofurls is required/i,
    display: {
      title: "No frames received",
      message: "No proof frames were received. Record again and try uploading.",
      kind: "upload",
    },
  },
  {
    test: /storage not configured/i,
    display: {
      title: "Upload unavailable",
      message: "Image upload is temporarily unavailable. Please try again later.",
      kind: "upload",
    },
  },
  {
    test: /failed to upload image|upload failed/i,
    display: {
      title: "Upload failed",
      message: "We couldn't upload your frames. Check your connection and try again.",
      kind: "upload",
    },
  },
  {
    test: /milestone already completed/i,
    display: {
      title: "Already submitted",
      message: "You already completed this day.",
      kind: "validation",
    },
  },
  {
    test: /campaign has ended/i,
    display: {
      title: "Campaign ended",
      message: "This campaign has ended, so proof can't be submitted.",
      kind: "validation",
    },
  },
  {
    test: /not open for participation/i,
    display: {
      title: "Not open",
      message: "This campaign isn't open for participation right now.",
      kind: "validation",
    },
  },
  {
    test: /^(proof was not accepted\.?|proof not accepted\.?)$/i,
    display: {
      title: "Proof not accepted",
      message: "Your proof wasn't accepted. Try a clearer photo that shows the activity.",
      kind: "ai",
    },
  },
];

const DEFAULT_DISPLAY: ProofErrorDisplay = {
  title: "Couldn't submit proof",
  message: "Something went wrong. Please try again.",
  kind: "unknown",
};

function rawMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string") return msg.trim();
  }
  return "";
}

function extractCommunityErrorName(error: unknown): string | null {
  if (error instanceof BaseError) {
    const revertError = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revertError instanceof ContractFunctionRevertedError) {
      return revertError.data?.errorName ?? null;
    }
  }

  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.startsWith("0x")) {
      try {
        return decodeErrorResult({
          abi: COMMUNITY_CAMPAIGN_ABI,
          data: data as `0x${string}`,
        }).errorName;
      } catch {
        // fall through
      }
    }
  }

  const msg = rawMessage(error);
  if (!msg) return null;
  const match =
    msg.match(
      /\b(AlreadyCompleted|ProofAfterDeadline|ProofBeforeStart|NotJoined|InvalidProof|MilestoneNotFound|CampaignNotFound|AlreadyEnded|CampaignNotEnded|Unauthorized|InvalidInput)\b/,
    ) ?? msg.match(/(?:reverted with reason|revert|Error):\s*(\w+)/i);
  return match?.[1] ?? null;
}

function looksTechnical(msg: string): boolean {
  if (msg.length > 180) return true;
  return (
    /0x[a-f0-9]{8,}/i.test(msg) ||
    /ContractFunction/i.test(msg) ||
    /execution reverted/i.test(msg) ||
    /Internal JSON-RPC/i.test(msg) ||
    /TransactionReceipt/i.test(msg) ||
    /EstimateGasExecutionError/i.test(msg) ||
    /HttpRequestError/i.test(msg) ||
    /Details:\s*\{/i.test(msg)
  );
}

function isUserRejected(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction was cancelled") ||
    lower.includes("request rejected") ||
    lower.includes("user cancelled") ||
    lower.includes("user canceled")
  );
}

function isNetworkish(msg: string, error?: unknown): boolean {
  if (error instanceof TypeError && /fetch/i.test(msg)) return true;
  const lower = msg.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("err_internet") ||
    lower.includes("offline")
  );
}

/** Camera / getUserMedia failures — never show raw DOMException names alone. */
export function formatCameraError(error: unknown): ProofErrorDisplay {
  if (typeof window !== "undefined") {
    const secure =
      window.isSecureContext ||
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    if (!secure) {
      return {
        title: "Camera needs a secure page",
        message: "Open this page over HTTPS (or on localhost), then allow camera access and try again.",
        kind: "camera",
      };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        title: "Camera not supported",
        message: "This browser can't use the camera. Open the page in Safari or Chrome on your phone.",
        kind: "camera",
      };
    }
  }

  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const msg = rawMessage(error).toLowerCase();

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    msg.includes("permission") ||
    msg.includes("not allowed") ||
    msg.includes("denied")
  ) {
    return {
      title: "Camera access needed",
      message:
        "Camera access was blocked. In your browser settings, allow camera for this site, then tap Try again.",
      kind: "camera",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError" || msg.includes("not found")) {
    return {
      title: "No camera found",
      message: "We couldn't find a camera on this device. Check that the camera isn't disconnected, then try again.",
      kind: "camera",
    };
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    msg.includes("could not start") ||
    msg.includes("in use")
  ) {
    return {
      title: "Camera is busy",
      message: "Another app may be using the camera. Close it, then tap Try again.",
      kind: "camera",
    };
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      title: "Camera settings failed",
      message: "This camera couldn't start with the required settings. Tap Try again, or switch browsers.",
      kind: "camera",
    };
  }

  if (name === "SecurityError" || msg.includes("secure")) {
    return {
      title: "Camera blocked",
      message: "Your browser blocked the camera for security reasons. Use HTTPS and allow camera access.",
      kind: "camera",
    };
  }

  if (name === "AbortError") {
    return {
      title: "Camera interrupted",
      message: "Camera startup was interrupted. Tap Try again.",
      kind: "camera",
    };
  }

  if (name === "NotSupportedError" || msg.includes("camera api unavailable")) {
    return {
      title: "Camera not supported",
      message: "This browser can't use the camera. Open the page in Safari or Chrome on your phone.",
      kind: "camera",
    };
  }

  return {
    title: "Couldn't start camera",
    message: "We couldn't start the camera. Check permissions and try again.",
    kind: "camera",
  };
}

/** Upload / network failures while sending frames. */
export function formatUploadError(error: unknown): ProofErrorDisplay {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      title: "Upload timed out",
      message: "Upload timed out. Check your connection and try again.",
      kind: "upload",
    };
  }

  const msg = rawMessage(error);
  if (isNetworkish(msg, error)) {
    return {
      title: "Connection problem",
      message: "We couldn't reach the server. Check your internet connection and try again.",
      kind: "network",
    };
  }

  for (const { test, display } of API_MESSAGE_MAP) {
    if (test.test(msg)) return display;
  }

  if (msg && !looksTechnical(msg)) {
    return { title: "Upload failed", message: msg, kind: "upload" };
  }

  return {
    title: "Upload failed",
    message: "We couldn't upload your frames. Check your connection and try again.",
    kind: "upload",
  };
}

/**
 * AI / API / wallet / contract failures after frames are uploaded.
 * Safe to pass any thrown value from the proof submit path.
 */
export function formatProofError(error: unknown): ProofErrorDisplay {
  if (!error) return DEFAULT_DISPLAY;

  const communityName = extractCommunityErrorName(error);
  if (communityName && COMMUNITY_PROOF_REVERTS[communityName]) {
    return COMMUNITY_PROOF_REVERTS[communityName];
  }

  if (isInsufficientGasError(error)) {
    return {
      title: "Not enough gas",
      message: "Not enough CELO for gas fees. Top up a little CELO, then try again.",
      kind: "wallet",
    };
  }

  const msg = rawMessage(error);

  if (isUserRejected(msg)) {
    return {
      title: "Cancelled",
      message: "You cancelled the wallet request. Tap Try again when you're ready to confirm.",
      kind: "wallet",
    };
  }

  if (isNetworkish(msg, error)) {
    return {
      title: "Connection problem",
      message: "We couldn't reach the server. Check your internet connection and try again.",
      kind: "network",
    };
  }

  for (const { test, display } of API_MESSAGE_MAP) {
    if (test.test(msg)) return display;
  }

  // AI rejection reasons (and other short human copy) must stay intact for the UI.
  if (msg && !looksTechnical(msg)) {
    const lower = msg.toLowerCase();
    const kind: ProofErrorKind =
      lower.includes("not accept") ||
      lower.includes("doesn't show") ||
      lower.includes("does not show") ||
      lower.includes("doesn't look") ||
      lower.includes("does not look") ||
      lower.includes("unrelated") ||
      lower.includes("instead")
        ? "ai"
        : lower.includes("wallet") || lower.includes("transaction") || lower.includes("gas")
          ? "wallet"
          : lower.includes("upload") || lower.includes("frame")
            ? "upload"
            : "unknown";
    const title =
      kind === "ai"
        ? "Proof not accepted"
        : kind === "wallet"
          ? "Couldn't confirm"
          : kind === "upload"
            ? "Upload failed"
            : "Couldn't submit proof";
    return { title, message: msg, kind };
  }

  if (communityName) {
    return {
      title: "Transaction failed",
      message: `The network rejected this submission (${communityName}). Please try again.`,
      kind: "wallet",
    };
  }

  return DEFAULT_DISPLAY;
}

export function proofErrorMessage(error: unknown): string {
  return formatProofError(error).message;
}
