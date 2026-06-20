"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseUnits, decodeErrorResult } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI_WITH_COMMUNITY } from "@/lib/abi/delulu-with-community";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useFundCommunityChallenge() {
  const chainId = useChainId();
  const { writeContractAsync, data: hash, isPending, error, reset } =
    useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const fundCommunityChallenge = async (
    challengeId: number | bigint,
    poolAmount: number,
  ) => {
    if (!Number.isFinite(poolAmount) || poolAmount <= 0) {
      throw new Error("Pool amount must be greater than 0");
    }
    const amountWei = parseUnits(poolAmount.toString(), 18);
    return writeContractAsync({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI_WITH_COMMUNITY,
      functionName: "fundCommunityChallenge",
      args: [BigInt(challengeId), amountWei],
    });
  };

  const isError = !!error || !!receiptError;
  let errorMessage: string | null = null;
  if (error || receiptError) {
    try {
      const err = error || receiptError;
      if (err && typeof err === "object" && "data" in err) {
        const decoded = decodeErrorResult({
          abi: DELULU_ABI_WITH_COMMUNITY,
          data: err.data as `0x${string}`,
        });
        errorMessage =
          decoded.args?.[0]?.toString() || decoded.errorName || "Transaction failed";
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = err.message as string;
      }
    } catch {
      errorMessage = error?.message || receiptError?.message || "Transaction failed";
    }
  }

  return {
    fundCommunityChallenge,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    reset,
  };
}
