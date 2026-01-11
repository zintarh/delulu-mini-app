import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/fetchers";

export function useCancelDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });
  const queryClient = useQueryClient();

  const pendingCancelRef = useRef<{
    deluluId: string;
    creatorAddress: string;
  } | null>(null);
  const lastSyncedHash = useRef<string | null>(null);




  const syncMutation = useMutation({
    mutationFn: async ({
      deluluId,
      creatorAddress,
    }: {
      deluluId: string;
      creatorAddress: string;
    }) => {
      return api.cancelDelulu(deluluId, creatorAddress);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
      if (pendingCancelRef.current) {
        queryClient.invalidateQueries({
          queryKey: ["delulu", pendingCancelRef.current.deluluId],
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
      pendingCancelRef.current &&
      txHash !== lastSyncedHash.current &&
      !syncMutation.isPending &&
      !syncMutation.isSuccess
    ) {
      lastSyncedHash.current = txHash;
      syncMutation.mutate({
        deluluId: pendingCancelRef.current.deluluId,
        creatorAddress: pendingCancelRef.current.creatorAddress,
      });
      pendingCancelRef.current = null;
    }
  }, [isSuccess, receipt?.transactionHash, syncMutation]);

  const cancel = async (deluluId: number, creatorAddress: string) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }
    if (!creatorAddress) {
      throw new Error("Creator address is required");
    }

    // Store for backend sync
    pendingCancelRef.current = {
      deluluId: deluluId.toString(),
      creatorAddress,
    };

    try {
      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "cancelDelulu",
        args: [BigInt(deluluId)],
      });
    } catch (err) {
      pendingCancelRef.current = null;
      handleCancelError(err);
    }
  };

  // Format error for display
  const formattedError = error || receiptError;
  const displayError = formattedError
    ? formatErrorForDisplay(formattedError)
    : null;

  return {
    cancel,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: displayError,
  };
}

function formatErrorForDisplay(error: unknown): Error {
  if (error instanceof Error) {
    const err = error as {
      message?: string;
      code?: number;
      shortMessage?: string;
      details?: string;
    };

    const msg = (err?.message?.toLowerCase() ?? "").trim();
    const shortMsg = (err?.shortMessage?.toLowerCase() ?? "").trim();
    const details = (err?.details?.toLowerCase() ?? "").trim();
    const code = err?.code;

    // Combine all error messages for checking
    const combinedError = `${msg} ${shortMsg} ${details}`.toLowerCase();

    // User rejection
    if (
      msg.includes("user rejected") ||
      msg.includes("user denied") ||
      msg.includes("user cancelled") ||
      msg.includes("denied transaction signature") ||
      shortMsg.includes("user rejected") ||
      shortMsg.includes("user denied") ||
      shortMsg.includes("denied transaction") ||
      details.includes("user denied") ||
      details.includes("denied transaction signature") ||
      combinedError.includes("user denied transaction signature") ||
      combinedError.includes("user rejected the request") ||
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

    // Generic contract errors
    if (
      combinedError.includes("execution reverted") ||
      combinedError.includes("revert")
    ) {
      if (
        combinedError.includes("not found") ||
        combinedError.includes("delulu not found")
      ) {
        return new Error("Delulu not found");
      }
      if (
        combinedError.includes("resolved") ||
        combinedError.includes("already resolved")
      ) {
        return new Error("Cannot cancel a resolved delulu");
      }
      if (
        combinedError.includes("owner") ||
        combinedError.includes("only owner") ||
        combinedError.includes("unauthorized")
      ) {
        return new Error("Only the creator can cancel");
      }
      if (
        combinedError.includes("cancelled") ||
        combinedError.includes("already cancelled")
      ) {
        return new Error("Already cancelled");
      }
      return new Error("Transaction failed");
    }

    // Clean up technical error messages
    if (
      msg.includes("callexecutionerror") ||
      msg.includes("contractfunctionexecutionerror")
    ) {
      return new Error("Transaction failed");
    }
  }

  // Fallback
  return new Error("Transaction failed");
}

function handleCancelError(error: unknown): never {
  const err = error as {
    message?: string;
    code?: number;
    shortMessage?: string;
    details?: string;
  };

  const msg = (err?.message?.toLowerCase() ?? "").trim();
  const shortMsg = (err?.shortMessage?.toLowerCase() ?? "").trim();
  const details = (err?.details?.toLowerCase() ?? "").trim();
  const code = err?.code;

  // Combine all error messages for checking
  const combinedError = `${msg} ${shortMsg} ${details}`.toLowerCase();

  // User rejection - check for various rejection patterns
  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    msg.includes("denied transaction signature") ||
    shortMsg.includes("user rejected") ||
    shortMsg.includes("user denied") ||
    shortMsg.includes("denied transaction") ||
    details.includes("user denied") ||
    details.includes("denied transaction signature") ||
    combinedError.includes("user denied transaction signature") ||
    combinedError.includes("user rejected the request") ||
    code === 4001
  ) {
    throw new Error("Transaction cancelled");
  }

  // Network issues
  if (
    code === -32019 ||
    msg.includes("out of range") ||
    msg.includes("block is out of range") ||
    msg.includes("network")
  ) {
    throw new Error("Network issue. Please wait a moment and try again");
  }

  // Generic error message matching
  const combinedMsg = `${msg} ${shortMsg}`.toLowerCase();
  if (
    combinedMsg.includes("execution reverted") ||
    combinedMsg.includes("revert")
  ) {
    if (
      combinedMsg.includes("not found") ||
      combinedMsg.includes("delulu not found")
    ) {
      throw new Error("This delulu was not found");
    }
    if (
      combinedMsg.includes("resolved") ||
      combinedMsg.includes("already resolved")
    ) {
      throw new Error("Cannot cancel a delulu that has already been resolved");
    }
    if (
      combinedMsg.includes("owner") ||
      combinedMsg.includes("only owner") ||
      combinedMsg.includes("unauthorized")
    ) {
      throw new Error("Only the creator can cancel this delulu");
    }
    if (
      combinedMsg.includes("cancelled") ||
      combinedMsg.includes("already cancelled")
    ) {
      throw new Error("This delulu has already been cancelled");
    }
    throw new Error(
      "Transaction failed. Please check your connection and try again"
    );
  }

  // Final fallback
  throw new Error(
    err?.shortMessage || err?.message || "Transaction failed"
  );
}
