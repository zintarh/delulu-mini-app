import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { decodeErrorResult } from "viem";

export function useSetProfile() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const setProfile = async (username: string, metadataHash: string) => {
    if (!username || username.trim().length === 0) {
      throw new Error("Username is required");
    }
    if (!metadataHash || metadataHash.trim().length === 0) {
      throw new Error("Metadata hash is required");
    }

    try {
      writeContract({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "setProfile",
        args: [username.trim(), metadataHash.trim()],
      });
    } catch (err) {
      throw formatErrorForDisplay(err);
    }
  };

  const formattedError = error || receiptError;
  const displayError = formattedError
    ? formatErrorForDisplay(formattedError)
    : null;

  return {
    setProfile,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError: !!displayError,
    error: displayError,
    isWalletPending: isPending,
    isConfirming,
  };
}

function formatErrorForDisplay(error: unknown): Error {
  const err = error as { message?: string; data?: unknown; cause?: unknown };

  if (err?.data) {
    try {
      const decoded = decodeErrorResult({
        abi: DELULU_ABI,
        data: err.data as `0x${string}`,
      });

      const errorMessage = decoded.args?.[0];
      const message = typeof errorMessage === "string" 
        ? errorMessage 
        : decoded.errorName || "Transaction failed";
      return new Error(message);
    } catch {
      // If decoding fails, fall through to default error handling
    }
  }

  if (err?.message) {
    // Extract user-friendly error messages
    if (err.message.includes("UsernameAlreadyTaken")) {
      return new Error("This username is already taken");
    }
    if (err.message.includes("UsernameTooShort")) {
      return new Error("Username must be at least 3 characters");
    }
    if (err.message.includes("UsernameTooLong")) {
      return new Error("Username must be 16 characters or less");
    }
    if (err.message.includes("UsernameInvalid")) {
      return new Error("Username can only contain letters, numbers, and underscores");
    }
    if (err.message.includes("user rejected")) {
      return new Error("Transaction was cancelled");
    }
    return new Error(err.message);
  }

  return new Error("An unknown error occurred");
}
