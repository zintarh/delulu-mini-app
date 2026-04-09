import {
  useWaitForTransactionReceipt,
  useChainId,
  useWriteContract,
} from "wagmi";
import { useState } from "react";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { decodeErrorResult } from "viem";

export function useSetProfile() {
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const setProfile = async (username: string) => {
    if (!username || username.trim().length === 0) {
      throw new Error("Username is required");
    }
    try {
      setIsPending(true);
      setWriteError(null);
      const txHash = await writeContractAsync({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "setProfile",
        args: [username.trim()],
      });
      setHash(txHash);
    } catch (err) {
      const formatted = formatErrorForDisplay(err);
      setWriteError(formatted);
      throw formatted;
    } finally {
      setIsPending(false);
    }
  };

  const formattedError = writeError || receiptError;
  const displayError = formattedError ? formatErrorForDisplay(formattedError) : null;

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
  const err = error as { message?: string; data?: unknown };

  if (err?.data) {
    try {
      const decoded = decodeErrorResult({ abi: DELULU_ABI, data: err.data as `0x${string}` });
      const errorMessage = decoded.args?.[0];
      const message = typeof errorMessage === "string" ? errorMessage : decoded.errorName || "Transaction failed";
      return new Error(message);
    } catch {}
  }

  if (err?.message) {
    if (err.message.includes("UsernameAlreadyTaken")) return new Error("This username is already taken");
    if (err.message.includes("UsernameTooShort")) return new Error("Username must be at least 3 characters");
    if (err.message.includes("UsernameTooLong")) return new Error("Username must be 16 characters or less");
    if (err.message.includes("UsernameInvalid")) return new Error("Username can only contain letters, numbers, and underscores");
    if (err.message.includes("user rejected")) return new Error("Transaction was cancelled");
    return new Error(err.message);
  }

  return new Error("An unknown error occurred");
}
