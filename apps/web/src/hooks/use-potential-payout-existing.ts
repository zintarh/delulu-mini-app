import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

/**
 * Hook to get potential payout for an EXISTING stake position (for active markets)
 * This calculates what the user would win if their side wins, based on their current stake
 * without adding the stake to the pool (since it's already there)
 */
export function usePotentialPayoutForExistingStake(deluluId: number | null) {
  const { address } = useAccount();

  const {
    data: payout,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getPotentialPayoutForExistingStake",
    args:
      deluluId !== null && address
        ? [BigInt(deluluId), address]
        : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  return {
    potentialPayout: payout && typeof payout === "bigint" ? parseFloat(formatUnits(payout, 18)) : null,
    isLoading,
    error,
  };
}

