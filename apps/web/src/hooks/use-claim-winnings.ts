import { useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";

export function useClaimWinnings() {
  const { writeContractAsync } = useUnifiedWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const claim = async (deluluId: number) => {
    if (!Number.isFinite(deluluId) || deluluId < 0) return;
    try {
      setIsPending(true);
      setWriteError(null);
      const txHash = await writeContractAsync({
        address: getDeluluContractAddress(DELULU_CHAIN_ID),
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
