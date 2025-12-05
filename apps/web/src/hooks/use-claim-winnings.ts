import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useState, useEffect } from "react";

export function useClaimWinnings() {
  const [deluluId, setDeluluId] = useState<number | null>(null);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const claim = (id: number) => {
    if (!id) return;
    setDeluluId(id);
    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "claimWinnings",
      args: [BigInt(id)],
    });
  };

  useEffect(() => {
    if (isSuccess) {
      setDeluluId(null);
    }
  }, [isSuccess]);

  return {
    claim,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}

