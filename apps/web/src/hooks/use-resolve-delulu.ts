import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/fetchers";
import { decodeErrorResult } from "viem";

export function useResolveDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  const pendingResolveRef = useRef<{
    deluluId: string;
    outcome: boolean;
  } | null>(null);
  const lastSyncedHash = useRef<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: async ({
      deluluId,
      outcome,
    }: {
      deluluId: string;
      outcome: boolean;
    }) => {
      return api.resolveDelulu(deluluId, outcome);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
      if (pendingResolveRef.current) {
        queryClient.invalidateQueries({
          queryKey: ["delulu", pendingResolveRef.current.deluluId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["user-delulus"] });
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  useEffect(() => {
    const txHash = receipt?.transactionHash;
    if (
      isSuccess &&
      txHash &&
      pendingResolveRef.current &&
      txHash !== lastSyncedHash.current &&
      !syncMutation.isPending &&
      !syncMutation.isSuccess
    ) {
      lastSyncedHash.current = txHash;
      syncMutation.mutate({
        deluluId: pendingResolveRef.current.deluluId,
        outcome: pendingResolveRef.current.outcome,
      });
      pendingResolveRef.current = null;
    }
  }, [isSuccess, receipt?.transactionHash, syncMutation]);

  const resolve = async (
    deluluId: number,
    outcome: boolean,
    creatorAddress: string
  ) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }

    // Store for backend sync
    pendingResolveRef.current = {
      deluluId: deluluId.toString(),
      outcome,
    };

    try {
      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "resolveDelulu",
        args: [deluluId, outcome],
      });
    } catch (err) {
      pendingResolveRef.current = null;
      throw formatErrorForDisplay(err);
    }
  };

  // Format error for display
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
    isBackendSynced: syncMutation.isSuccess,
    isBackendSyncing: syncMutation.isPending,
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

  // Network issues
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
  const errorAny = err as any;

  if (typeof errorAny?.data === "string" && errorAny.data.startsWith("0x")) {
    errorData = errorAny.data;
  } else if (
    typeof errorAny?.cause?.data === "string" &&
    errorAny.cause.data.startsWith("0x")
  ) {
    errorData = errorAny.cause.data;
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
    } catch (decodeErr) {
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

  // Final fallback
  return new Error(err?.shortMessage || err?.message || "Transaction failed");
}
