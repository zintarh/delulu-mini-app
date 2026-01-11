import { parseUnits } from "viem";

// Constants
export const MAX_DELULU_LENGTH = 140;
export const MIN_STAKE = 1;
export const MAX_STAKE = 1000;
export const IPFS_UPLOAD_TIMEOUT = 30000; // 30 seconds
export const ALLOWANCE_CHECK_RETRIES = 3;
export const ALLOWANCE_CHECK_DELAY = 500; // milliseconds

// Types
export interface ValidationErrors {
  text: string | null;
  stake: string | null;
  balance: string | null;
  image: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
  canCreate: boolean;
}

export interface ProgressStep {
  step: number;
  total: number;
  label: string;
}

// Date helpers
export function getDefaultDeadline(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function getMinDeadline(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 24);
  return date;
}

export function getMaxDeadline(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

// Validation helpers
export function validateDeluluInputs(
  delusionText: string,
  stakeAmount: number,
  maxStakeValue: number,
  selectedImage: string | null
): ValidationResult {
  const errors: ValidationErrors = {
    text: null,
    stake: null,
    balance: null,
    image: null,
  };

  // Text validation
  if (!delusionText.trim()) {
    errors.text = "Please enter your delulu text";
  } else if (delusionText.length > MAX_DELULU_LENGTH) {
    errors.text = `Text must be ${MAX_DELULU_LENGTH} characters or less`;
  }

  // Stake validation
  if (stakeAmount < MIN_STAKE) {
    errors.stake = `Minimum stake is ${MIN_STAKE} cUSD`;
  }

  // Balance validation
  if (!isFinite(maxStakeValue) || maxStakeValue < MIN_STAKE) {
    errors.balance = `Insufficient balance. You need at least ${MIN_STAKE} cUSD to stake.`;
  } else if (stakeAmount > maxStakeValue) {
    const displayBalance = isFinite(maxStakeValue)
      ? maxStakeValue.toFixed(2)
      : "0.00";
    errors.balance = `Amount exceeds your balance of ${displayBalance} cUSD.`;
  }

  // Image validation
  if (!selectedImage) {
    errors.image = "Please select a template or upload an image";
  }

  const isValid =
    !errors.text && !errors.stake && !errors.balance && !errors.image;
  const canCreate =
    isValid &&
    delusionText.trim().length > 0 &&
    stakeAmount >= MIN_STAKE &&
    stakeAmount <= maxStakeValue &&
    !!selectedImage;

  return { isValid, errors, canCreate };
}

// Stake amount helpers
export function clampStakeValue(val: number): number {
  return Math.min(Math.max(val, MIN_STAKE), MAX_STAKE);
}

export function calculateMaxStakeValue(
  cusdBalance: { formatted: string } | undefined
): number {
  if (cusdBalance?.formatted) {
    const balance = parseFloat(cusdBalance.formatted);
    if (isFinite(balance) && !isNaN(balance)) {
      return Math.min(Math.max(balance, 0), MAX_STAKE);
    }
  }
  return 0;
}

// Error message helpers
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes("fetch") || message.includes("network")) {
      return "Network error. Please check your connection and try again.";
    }

    // IPFS errors
    if (message.includes("ipfs") || message.includes("upload")) {
      return "Failed to upload content. Please try again.";
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return "Request timed out. Please try again.";
    }

    // Blockchain errors
    if (
      message.includes("user rejected") ||
      message.includes("denied") ||
      message.includes("rejected")
    ) {
      return "Transaction was cancelled.";
    }

    if (
      message.includes("insufficient funds") ||
      message.includes("insufficient balance")
    ) {
      return "Insufficient balance for transaction.";
    }

    if (message.includes("allowance")) {
      return "Token allowance not updated. Please try again.";
    }

    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              errorMessage || `Operation timed out after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    ),
  ]);
}

export async function checkAllowanceWithRetry(
  refetchAllowance: () => Promise<{ data: bigint | undefined }>,
  stakeAmount: number,
  maxRetries: number = ALLOWANCE_CHECK_RETRIES,
  initialDelay: number = ALLOWANCE_CHECK_DELAY
): Promise<boolean> {
  if (!isFinite(stakeAmount) || isNaN(stakeAmount) || stakeAmount <= 0) {
    throw new Error("Invalid stake amount for allowance check");
  }

  let amountWei;
  try {
    amountWei = parseUnits(stakeAmount.toString(), 18);
  } catch (error) {
    throw new Error("Failed to parse stake amount");
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await refetchAllowance();

      if (result.data && result.data >= amountWei) {
        return true;
      }

      if (i < maxRetries - 1) {
        const delay = initialDelay * (i + 1); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.warn(`[checkAllowanceWithRetry] Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) {
        throw error;
      }
    }
  }

  return false;
}

export function getProgressStep(
  isUploadingImage: boolean,
  isApproving: boolean,
  isApprovingConfirming: boolean,
  isCreating: boolean,
  isConfirming: boolean
): ProgressStep | null {
  if (isUploadingImage) {
    return { step: 1, total: 4, label: "Preparing Delulu..." };
  }
  if (isApproving || isApprovingConfirming) {
    return { step: 2, total: 4, label: "Approving tokens..." };
  }
  if (isCreating) {
    return { step: 3, total: 4, label: "Creating Delulu..." };
  }
  if (isConfirming) {
    return { step: 4, total: 4, label: "Creating Delulu..." };
  }
  return null;
}

export function getDefaultImageUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/templates/t0.png`;
  }
  return "/templates/t0.png"; 
}

export function getOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "";
}
