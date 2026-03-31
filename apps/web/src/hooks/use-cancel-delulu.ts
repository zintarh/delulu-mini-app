import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useCancelDelulu() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const cancel = async (deluluId: number, _creatorAddress: string) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }

    try {
      writeContract({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "cancelDelulu" as never,
        args: [BigInt(deluluId)],
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

    const combinedError = `${msg} ${shortMsg} ${details}`.toLowerCase();

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

    if (
      code === -32019 ||
      msg.includes("out of range") ||
      msg.includes("block is out of range") ||
      msg.includes("network")
    ) {
      return new Error("Network issue. Please try again");
    }

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

    if (
      msg.includes("callexecutionerror") ||
      msg.includes("contractfunctionexecutionerror")
    ) {
      return new Error("Transaction failed");
    }
  }

  return new Error("Transaction failed");
}
