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

  const rawError = writeError || receiptError;
  const errorMessage = rawError ? formatClaimError(rawError) : null;

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: rawError,
    errorMessage,
  };
}

function formatClaimError(error: unknown): string {
  const err = error as { message?: string; shortMessage?: string; code?: number };
  const msg = (err?.message ?? "").toLowerCase();
  const short = (err?.shortMessage ?? "").toLowerCase();
  const combined = `${msg} ${short}`;

  if (combined.includes("user rejected") || combined.includes("user denied") || err?.code === 4001) {
    return "Transaction cancelled";
  }
  if (combined.includes("already claimed") || combined.includes("alreadyclaimed")) {
    return "Winnings already claimed";
  }
  if (combined.includes("not found") || combined.includes("delulunotfound")) {
    return "Delulu not found";
  }
  if (combined.includes("not resolved") || combined.includes("not settled")) {
    return "This delulu hasn't been resolved yet";
  }
  if (combined.includes("insufficient") || combined.includes("no winnings")) {
    return "No winnings to claim";
  }
  if (combined.includes("network") || combined.includes("out of range")) {
    return "Network error. Please try again";
  }
  return err?.shortMessage || err?.message || "Failed to claim winnings";
}
