import { useWaitForTransactionReceipt, useChainId, useWriteContract } from "wagmi";
import { useState } from "react";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useClaimWinnings() {
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

  const claim = async (deluluId: number) => {
    if (!deluluId || Number.isNaN(deluluId)) return;
    try {
      setIsPending(true);
      setWriteError(null);
      const txHash = await writeContractAsync({
        address: getDeluluContractAddress(chainId),
        abi: DELULU_ABI,
        functionName: "claimPersonalMarketSupport",
        args: [BigInt(deluluId)],
      });
      setHash(txHash);
    } catch (err) {
      setWriteError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPending(false);
    }
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError || receiptError,
  };
}
