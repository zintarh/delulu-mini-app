import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const stake = async (deluluId: number, amount: number, isBeliever: boolean) => {
    // Validate inputs
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }
    
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Stake amount must be greater than 0");
    }

    try {
      const amountWei = parseUnits(amount.toString(), 18);
      // minPayout: 0 for now (no slippage protection)
      const minPayout = 0n;

      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "stakeOnDelulu",
        args: [BigInt(deluluId), isBeliever, amountWei, minPayout],
      });
    } catch (error: any) {
      console.error("Error in stake function:", error);
      
      // Handle RPC sync errors
      if (
        error?.code === -32019 ||
        error?.message?.includes("block is out of range") ||
        error?.message?.includes("out of range")
      ) {
        throw new Error(
          "Network synchronization issue. The RPC node is catching up. Please wait a moment and try again."
        );
      }
      
      // Handle other common RPC errors
      if (error?.code === -32603 || error?.message?.includes("execution reverted")) {
        // Try to extract revert reason
        const revertReason = error?.data?.message || error?.message || "Transaction reverted";
        throw new Error(`Transaction failed: ${revertReason}`);
      }
      
      throw error;
    }
  };

  return {
    stake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}

