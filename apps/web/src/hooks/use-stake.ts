import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
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
  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash });
  const { syncStake } = useBackendSync();

  // Track pending stake for backend sync
  const pendingStake = useRef<StakeParams | null>(null);

  // Sync to backend after successful transaction
  useEffect(() => {
    if (isSuccess && hash && pendingStake.current) {
      const { deluluId, amount, isBeliever } = pendingStake.current;
      syncStake({
        deluluId,
        amount,
        side: isBeliever,
        txHash: hash,
      });
      pendingStake.current = null;
    }
  }, [isSuccess, hash, syncStake]);

  const stake = async (deluluId: number, amount: number, isBeliever: boolean) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Stake amount must be greater than 0");
    }

    // Store for backend sync
    pendingStake.current = { deluluId: deluluId.toString(), amount, isBeliever };

    try {
      const amountWei = parseUnits(amount.toString(), 18);

      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "stakeOnDelulu",
        args: [BigInt(deluluId), amountWei, isBeliever], // deluluId, amount, side
      });
    } catch (err) {
      pendingStake.current = null;
      handleStakeError(err);
    }
  };

  return { stake, hash, isPending, isConfirming, isSuccess, error: error || receiptError };
}

function handleStakeError(error: unknown): never {
  const err = error as { message?: string; code?: number; shortMessage?: string };
  const msg = err?.message?.toLowerCase() ?? "";
  const code = err?.code;

  if (msg.includes("user rejected") || msg.includes("user denied") || code === 4001) {
    throw new Error("Transaction was cancelled");
  }
  if (code === -32019 || msg.includes("out of range")) {
    throw new Error("Network sync issue. Please try again.");
  }
  if (msg.includes("execution reverted")) {
    if (msg.includes("deadline")) throw new Error("Staking deadline has passed");
    if (msg.includes("resolved")) throw new Error("Delulu already resolved");
    if (msg.includes("cancelled")) throw new Error("Delulu was cancelled");
    throw new Error("Transaction failed");
  }
  throw new Error(err?.shortMessage || "Transaction failed");
}
