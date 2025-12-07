import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const stake = async (
    deluluId: number,
    amount: number,
    isBeliever: boolean
  ) => {
    // Validate inputs
    if (isNaN(deluluId) || deluluId <= 0) {
      console.error("[useStake] Invalid delulu ID:", deluluId);
      throw new Error("Invalid delulu ID");
    }

    if (isNaN(amount) || amount <= 0) {
      console.error("[useStake] Invalid amount:", amount);
      throw new Error("Stake amount must be greater than 0");
    }

    try {
      const amountWei = parseUnits(amount.toString(), 18);
      
      // Log staking attempt with full details
      console.log("[useStake] Attempting to stake:", {
        deluluId,
        amount,
        amountWei: amountWei.toString(),
        isBeliever,
        contractAddress: DELULU_CONTRACT_ADDRESS,
        functionName: "stakeOnDelulu",
        args: [BigInt(deluluId), amountWei, isBeliever],
      });

      // Contract function signature: stakeOnDelulu(uint256 deluluId, uint256 amount, bool side)
      // Note: isBeliever maps to side (true = believer, false = doubter)
      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "stakeOnDelulu",
        args: [BigInt(deluluId), amountWei, isBeliever],
      });
      
      console.log("[useStake] Write contract called successfully");
    } catch (error: any) {
      // Comprehensive error logging
      console.error("[useStake] Error in stake function:", {
        error,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorData: error?.data,
        errorShortMessage: error?.shortMessage,
        errorCause: error?.cause,
        stack: error?.stack,
        deluluId,
        amount,
        isBeliever,
        contractAddress: DELULU_CONTRACT_ADDRESS,
      });

      // Handle user rejection
      if (
        error?.message?.toLowerCase().includes("user rejected") ||
        error?.message?.toLowerCase().includes("user denied") ||
        error?.code === 4001
      ) {
        console.log("[useStake] User rejected transaction");
        throw new Error("Transaction was cancelled by user");
      }

      // Handle RPC sync errors
      if (
        error?.code === -32019 ||
        error?.message?.includes("block is out of range") ||
        error?.message?.includes("out of range")
      ) {
        console.error("[useStake] RPC sync error");
        throw new Error(
          "Network synchronization issue. The RPC node is catching up. Please wait a moment and try again."
        );
      }

      // Handle contract revert errors
      if (
        error?.code === -32603 ||
        error?.message?.includes("execution reverted") ||
        error?.shortMessage?.includes("execution reverted")
      ) {
        // Try to extract revert reason
        let revertReason = "Transaction reverted";
        
        // Check various error message formats
        if (error?.data?.message) {
          revertReason = error.data.message;
        } else if (error?.message) {
          // Try to extract from error message
          const revertMatch = error.message.match(/revert\s+(.+?)(?:\s|$)/i);
          if (revertMatch && revertMatch[1]) {
            revertReason = revertMatch[1].trim();
          } else {
            revertReason = error.message;
          }
        } else if (error?.shortMessage) {
          revertReason = error.shortMessage;
        }
        
        console.error("[useStake] Contract revert:", revertReason);
        
        // Map common revert reasons to user-friendly messages
        const revertLower = revertReason.toLowerCase();
        if (revertLower.includes("stakingdeadlinepassed") || revertLower.includes("deadline")) {
          throw new Error("Staking deadline has passed");
        } else if (revertLower.includes("deluluresolved") || revertLower.includes("resolved")) {
          throw new Error("This delulu has already been resolved");
        } else if (revertLower.includes("delulucancelled") || revertLower.includes("cancelled")) {
          throw new Error("This delulu has been cancelled");
        } else if (revertLower.includes("creatorcannotstake") || revertLower.includes("creator")) {
          throw new Error("Creators cannot stake on their own delulu");
        } else if (revertLower.includes("invalidamount") || revertLower.includes("amount")) {
          throw new Error("Invalid stake amount");
        } else if (revertLower.includes("insufficient") || revertLower.includes("balance")) {
          throw new Error("Insufficient balance");
        } else {
          throw new Error(`Transaction failed: ${revertReason}`);
        }
      }

      // Handle network/RPC errors
      if (
        error?.message?.toLowerCase().includes("network") ||
        error?.message?.toLowerCase().includes("connection") ||
        error?.message?.toLowerCase().includes("timeout") ||
        error?.code === "NETWORK_ERROR"
      ) {
        console.error("[useStake] Network error");
        throw new Error("Network error. Please check your connection and try again.");
      }

      // Handle gas estimation errors
      if (
        error?.message?.toLowerCase().includes("gas") ||
        error?.code === "UNPREDICTABLE_GAS_LIMIT"
      ) {
        console.error("[useStake] Gas estimation error");
        throw new Error("Transaction would fail. Please check your balance and the delulu status.");
      }

      // Generic error
      const errorMessage = error?.message || error?.shortMessage || "Unknown error occurred";
      console.error("[useStake] Generic error:", errorMessage);
      throw new Error(
        errorMessage.length > 150
          ? "Transaction failed. Please try again."
          : errorMessage
      );
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
