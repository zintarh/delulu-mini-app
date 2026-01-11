import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, decodeErrorResult } from "viem";
import { useEffect, useRef } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useBackendSync } from "./use-backend-sync";

interface StakeParams {
  deluluId: string;
  amount: number;
  isBeliever: boolean;
}

export function useStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const { syncStake } = useBackendSync();

  const pendingStake = useRef<StakeParams | null>(null);
  const lastSyncedHash = useRef<string | null>(null);

  useEffect(() => {
    const txHash = receipt?.transactionHash;

    if (
      isSuccess &&
      txHash &&
      pendingStake.current &&
      txHash !== lastSyncedHash.current
    ) {
      const { deluluId, amount, isBeliever } = pendingStake.current;
      lastSyncedHash.current = txHash;
      pendingStake.current = null;

      syncStake({
        deluluId,
        amount,
        side: isBeliever,
        txHash: txHash,
      });
    }
  }, [isSuccess, receipt?.transactionHash, syncStake]);

  const stake = async (
    deluluId: number,
    amount: number,
    isBeliever: boolean
  ) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Stake amount must be greater than 0");
    }

    pendingStake.current = {
      deluluId: deluluId.toString(),
      amount,
      isBeliever,
    };

    try {
      const amountWei = parseUnits(amount.toString(), 18);
      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "stakeOnDelulu",
        args: [deluluId, Number(amountWei), isBeliever],
      });
    } catch (err) {
      pendingStake.current = null;
      handleStakeError(err);
    }
  };

  return {
    stake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}

function handleStakeError(error: unknown): never {
  const err = error as {
    message?: string;
    code?: number;
    shortMessage?: string;
    data?: string;
    cause?: { data?: string };
  };

  const msg = (err?.message?.toLowerCase() ?? "").trim();
  const shortMsg = (err?.shortMessage?.toLowerCase() ?? "").trim();
  const code = err?.code;

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    code === 4001
  ) {
    throw new Error("Transaction was cancelled");
  }

  if (
    code === -32019 ||
    msg.includes("out of range") ||
    msg.includes("block is out of range")
  ) {
    throw new Error(
      "Network synchronization issue. Please wait a moment and try again."
    );
  }

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
        DeluluNotFound: "Delulu not found",
        StakingIsClosed: "Staking deadline has passed",
        AlreadyResolved: "Delulu already resolved or cancelled",
        StakeTooSmall: "Stake amount is too small (minimum 1 cUSD)",
        StakeTooLarge: "Stake amount exceeds maximum limit",
        StakeLimitExceeded:
          "You've reached the maximum stake limit for this delulu",
        SlippageTooHigh:
          "Slippage protection: payout would be less than expected",
        SafeERC20FailedOperation:
          "Token transfer failed. Please check your balance and approval.",
      };

      const errorMessage =
        errorMessages[decoded.errorName] ||
        `Transaction failed: ${decoded.errorName}`;
      throw new Error(errorMessage);
    } catch (decodeErr) {
      // If decoding fails, fall through to generic error handling
    }
  }

  // Generic error message matching
  const combinedMsg = `${msg} ${shortMsg}`.toLowerCase();
  if (
    combinedMsg.includes("execution reverted") ||
    combinedMsg.includes("revert")
  ) {
    if (combinedMsg.includes("deadline"))
      throw new Error("Staking deadline has passed");
    if (combinedMsg.includes("resolved"))
      throw new Error("Delulu already resolved or cancelled");
    if (combinedMsg.includes("cancelled"))
      throw new Error("Delulu was cancelled");
    if (
      combinedMsg.includes("insufficient") ||
      combinedMsg.includes("balance")
    ) {
      throw new Error(
        "Insufficient balance or approval. Please check your cUSD balance and ensure you've approved the contract."
      );
    }
    if (combinedMsg.includes("allowance") || combinedMsg.includes("approve")) {
      throw new Error(
        "Token approval required. Please approve the contract to spend your cUSD."
      );
    }
    throw new Error(
      "Transaction failed. Please check your balance, approval, and try again."
    );
  }

  // Final fallback
  throw new Error(err?.shortMessage || err?.message || "Transaction failed");
}
