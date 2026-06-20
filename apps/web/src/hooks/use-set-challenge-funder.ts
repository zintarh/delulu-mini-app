"use client";

import { useWaitForTransactionReceipt, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

/** Owner-only: backfill funder for campaigns created before challengeFunder existed. */
export function useSetChallengeFunder() {
  const chainId = useChainId();
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useUnifiedWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash });

  const setChallengeFunder = async (
    challengeId: number,
    funder: `0x${string}`,
  ) => {
    await writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "setChallengeFunder",
      args: [BigInt(challengeId), funder],
    });
  };

  return {
    setChallengeFunder,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error: writeError || confirmError,
  };
}
