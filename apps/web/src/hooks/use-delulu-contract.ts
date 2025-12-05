import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { uploadToIPFS } from "@/lib/ipfs";

export function useCreateDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  const createDelulu = async (
    content: string,
    deadline: Date,
    amount: number
  ) => {
    try {
      // Upload content to IPFS
      const contentHash = await uploadToIPFS(content);
      
      if (!contentHash || typeof contentHash !== "string") {
        throw new Error("Invalid IPFS hash returned");
      }

      const stakingDeadline = BigInt(Math.floor(deadline.getTime() / 1000));
      
      const HOURS_24 = 24 * 60 * 60; // 86400 seconds
      const resolutionDeadline = stakingDeadline + BigInt(HOURS_24);
      
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (stakingDeadline <= now) {
        throw new Error("Deadline must be in the future");
      }

      const amountWei = parseUnits(amount.toString(), 18);

      if (amountWei <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }

      console.log("Creating delulu with:", {
        contentHash,
        stakingDeadline: stakingDeadline.toString(),
        resolutionDeadline: resolutionDeadline.toString(),
        amountWei: amountWei.toString(),
      });

      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "createDelulu",
        args: [contentHash, stakingDeadline, resolutionDeadline, amountWei],
      });
    } catch (error) {
      console.error("Error in createDelulu:", error);
      throw error;
    }
  };

  return {
    createDelulu,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}
