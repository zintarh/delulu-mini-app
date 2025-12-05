import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { uploadToIPFS } from "@/lib/ipfs";

export function useCreateDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createDelulu = async (
    content: string,
    deadline: Date,
    amount: number
  ) => {
    const contentHash = await uploadToIPFS(content);
    const deadlineTimestamp = BigInt(Math.floor(deadline.getTime() / 1000));
    const amountWei = parseUnits(amount.toString(), 18);

    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "createDelulu",
      args: [contentHash, deadlineTimestamp, deadlineTimestamp, amountWei],
    });
  };

  return {
    createDelulu,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
