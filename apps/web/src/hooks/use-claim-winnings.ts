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
  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash });
  const { syncClaim } = useBackendSync();

  // Track pending claim for backend sync
  const pendingClaim = useRef<ClaimParams | null>(null);

  // Sync to backend after successful transaction
  useEffect(() => {
    if (isSuccess && hash && pendingClaim.current) {
      const { deluluId, amount } = pendingClaim.current;
      syncClaim({ deluluId, amount, txHash: hash });
      pendingClaim.current = null;
    }
  }, [isSuccess, hash, syncClaim]);

  const claim = (deluluId: number, expectedAmount = 0) => {
    if (!deluluId) return;

    // Store for backend sync
    pendingClaim.current = { deluluId: deluluId.toString(), amount: expectedAmount };

    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "claimWinnings",
      args: [BigInt(deluluId)],
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error: error || receiptError };
}
