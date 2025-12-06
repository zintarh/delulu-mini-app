import { useReadContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function usePotentialPayout(
  deluluId: number | null,
  amount: number | null,
  isBeliever: boolean | null
) {
  const {
    data: payout,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getPotentialPayout",
    args:
      deluluId !== null &&
      amount !== null &&
      isBeliever !== null &&
      amount > 0
        ? [BigInt(deluluId), parseUnits(amount.toString(), 18), isBeliever]
        : undefined,
    query: {
      enabled:
        deluluId !== null &&
        amount !== null &&
        isBeliever !== null &&
        amount > 0,
    },
  });

  return {
    potentialPayout: payout && typeof payout === "bigint" ? parseFloat(formatUnits(payout, 18)) : null,
    isLoading,
    error,
  };
}

