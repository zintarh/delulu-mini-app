import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { decodeErrorResult } from "viem";

export function useResolveDelulu() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const resolve = async (
    deluluId: number,
    outcome: boolean,
    _creatorAddress: string
  ) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }

    try {
      writeContract({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "resolveDelulu",
        args: [deluluId, outcome],
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
    resolve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: displayError,
  };
}

function formatErrorForDisplay(error: unknown): Error {
  const err = error as {
    message?: string;
    code?: number;
    shortMessage?: string;
    data?: string;
    cause?: { data?: string; message?: string };
  };

  const msg = (err?.message?.toLowerCase() ?? "").trim();
  const shortMsg = (err?.shortMessage?.toLowerCase() ?? "").trim();
  const code = err?.code;

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    shortMsg.includes("user denied transaction signature") ||
    code === 4001
  ) {
    return new Error("Transaction cancelled");
  }

  if (
    code === -32019 ||
    msg.includes("out of range") ||
    msg.includes("block is out of range") ||
    msg.includes("network")
  ) {
    return new Error("Network issue. Please try again");
  }

  // Try to decode contract error data
  let errorData: string | undefined;
  const errorAny = err as Record<string, unknown>;

  if (typeof errorAny?.data === "string" && (errorAny.data as string).startsWith("0x")) {
    errorData = errorAny.data as string;
  } else if (
    typeof (errorAny?.cause as Record<string, unknown>)?.data === "string" &&
    ((errorAny.cause as Record<string, unknown>).data as string).startsWith("0x")
  ) {
    errorData = (errorAny.cause as Record<string, unknown>).data as string;
  }

  if (errorData) {
    try {
      const decoded = decodeErrorResult({
        abi: DELULU_ABI,
        data: errorData as `0x${string}`,
      });

      const errorMessages: Record<string, string> = {
        DeluluNotFound: "This delulu was not found",
        AlreadyResolved: "This delulu has already been resolved",
        AlreadyCancelled: "Cannot resolve a cancelled delulu",
        Unauthorized: "Only the creator can resolve this delulu",
      };

      return new Error(
        errorMessages[decoded.errorName] ||
          `Transaction failed: ${decoded.errorName}`
      );
    } catch {
      // Fall through to generic error handling if decoding fails
    }
  }

  const combinedMsg = `${msg} ${shortMsg}`.toLowerCase();
  if (
    combinedMsg.includes("execution reverted") ||
    combinedMsg.includes("revert")
  ) {
    if (
      combinedMsg.includes("not found") ||
      combinedMsg.includes("delulu not found")
    ) {
      return new Error("This delulu was not found");
    }
    if (
      combinedMsg.includes("resolved") ||
      combinedMsg.includes("already resolved")
    ) {
      return new Error("This delulu has already been resolved");
    }
    if (
      combinedMsg.includes("cancelled") ||
      combinedMsg.includes("already cancelled")
    ) {
      return new Error("Cannot resolve a cancelled delulu");
    }
    if (
      combinedMsg.includes("owner") ||
      combinedMsg.includes("only owner") ||
      combinedMsg.includes("unauthorized")
    ) {
      return new Error("Only the creator can resolve this delulu");
    }
    return new Error(
      "Transaction failed. Please check your connection and try again"
    );
  }

  return new Error(err?.shortMessage || err?.message || "Transaction failed");
}
