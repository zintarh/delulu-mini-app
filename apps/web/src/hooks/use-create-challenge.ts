import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useChainId } from "wagmi";
import { parseUnits } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { decodeErrorResult } from "viem";

export function useCreateChallenge() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const createChallenge = async (
    contentHash: string,
    poolAmount: number,
    durationInSeconds: number
  ) => {
    try {
      if (!contentHash || contentHash.trim().length === 0) {
        throw new Error("Content hash is required");
      }

      if (isNaN(poolAmount) || poolAmount <= 0) {
        throw new Error("Pool amount must be greater than 0");
      }

      if (isNaN(durationInSeconds) || durationInSeconds <= 0) {
        throw new Error("Duration must be greater than 0");
      }

      let amountWei;
      try {
        amountWei = parseUnits(poolAmount.toString(), 18);
      } catch {
        throw new Error("Invalid pool amount format");
      }

      if (amountWei <= 0n) {
        throw new Error("Pool amount must be greater than 0");
      }

      const contractAddress = getDeluluContractAddress(chainId);

      writeContract({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "createChallenge",
        args: [contentHash.trim(), amountWei, BigInt(durationInSeconds)],
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[DEV] Create challenge error:", {
          error,
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            contentHash: contentHash?.length ?? 0,
            poolAmount,
            durationInSeconds,
          },
        });
      }
      throw error;
    }
  };

  const isError = !!error || !!receiptError;
  let errorMessage: string | null = null;

  if (error || receiptError) {
    try {
      const err = error || receiptError;
      if (err && typeof err === "object" && "data" in err) {
        const decoded = decodeErrorResult({
          abi: DELULU_ABI,
          data: err.data as `0x${string}`,
        });
        errorMessage = decoded.args?.[0]?.toString() || decoded.errorName || err.message || "Unknown error";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = err.message as string;
      } else {
        errorMessage = "Failed to create challenge";
      }
    } catch {
      errorMessage = error?.message || receiptError?.message || "Failed to create challenge";
    }
  }

  return {
    createChallenge,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    isWalletPending: isPending,
    isConfirming,
  };
}
