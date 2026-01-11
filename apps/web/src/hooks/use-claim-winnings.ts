import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useRef } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useBackendSync } from "./use-backend-sync";

interface ClaimParams {
  deluluId: string;
  amount: number;
}

export function useClaimWinnings() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });
  const { syncClaim } = useBackendSync();

  // Track pending claim for backend sync
  const pendingClaim = useRef<ClaimParams | null>(null);
  const lastSyncedHash = useRef<string | null>(null);

  // Sync to backend after successful transaction
  useEffect(() => {
    const txHash = receipt?.transactionHash;
    if (
      isSuccess &&
      txHash &&
      pendingClaim.current &&
      txHash !== lastSyncedHash.current
    ) {
      lastSyncedHash.current = txHash;
      syncClaim({
        deluluId: pendingClaim.current.deluluId,
        amount: pendingClaim.current.amount,
        txHash: txHash,
      });
      pendingClaim.current = null;
    }
  }, [isSuccess, receipt?.transactionHash, syncClaim]);

  const claim = (deluluId: number, amount: number) => {
    if (!deluluId) return;
    if (amount <= 0) {
      console.warn("[useClaimWinnings] Claim amount must be greater than 0");
      return;
    }

    pendingClaim.current = {
      deluluId: deluluId.toString(),
      amount: amount,
    };

    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "claimWinnings",
      args: [deluluId],
    });
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}
