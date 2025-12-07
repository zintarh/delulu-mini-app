import { useAccount } from "wagmi";
import { useDelulus } from "./use-delulus";
import { useTotalClaimedAmount } from "./use-total-claimed-amount";
import { useMemo } from "react";

export function useUserStats() {
  const { address } = useAccount();
  const { delulus, isLoading } = useDelulus();
  const { totalClaimed, isLoading: isLoadingClaimed } = useTotalClaimedAmount();

  const stats = useMemo(() => {
    if (!address || isLoading) {
      return {
        createdCount: 0,
        totalStakes: 0,
        totalEarnings: 0,
        isLoading: true,
      };
    }

    // Count delulus created by user
    const createdCount = delulus.filter(
      (d) => d.creator.toLowerCase() === address.toLowerCase()
    ).length;

    // For total stakes and earnings, we'll calculate from the delulus data
    // Note: This is a simplified calculation. For accurate data, you'd need to:
    // 1. Fetch user positions for each delulu
    // 2. Check resolved delulus and calculate actual winnings
    // For now, we'll show placeholder values that can be enhanced later
    
    // Total stakes would be sum of all user stakes across all delulus
    // This requires checking getUserPosition for each delulu
    const totalStakes = 0; // Placeholder - needs contract calls

    // Total claimed amount from contract
    const totalEarnings = totalClaimed;

    return {
      createdCount,
      totalStakes,
      totalEarnings,
      isLoading: isLoading || isLoadingClaimed,
    };
  }, [address, delulus, isLoading, totalClaimed, isLoadingClaimed]);

  return stats;
}

