import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const stake = async (deluluId: number, amount: number, isBeliever: boolean) => {
    const amountWei = parseUnits(amount.toString(), 18);
    // minPayout: 0 for now (no slippage protection)
    const minPayout = 0n;

    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "stakeOnDelulu",
      args: [BigInt(deluluId), isBeliever, amountWei, minPayout],
    });
  };

  return {
    stake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

