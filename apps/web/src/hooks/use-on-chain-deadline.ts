import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useOnChainDeadline(deluluId: number | null) {
  const chainId = useChainId();
  const {
    data: deluluData,
    isLoading,
    error,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "getDelulu",
    args: deluluId !== null ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null,
    },
  });

  if (!deluluData) {
    return {
      stakingDeadline: null,
      resolutionDeadline: null,
      isLoading,
      error,
    };
  }

  // Handle both array and object return types from Viem
  let stakingDeadline: bigint;
  let resolutionDeadline: bigint;

  if (Array.isArray(deluluData)) {
    // If returned as array tuple: [id, creator, token, contentHash, stakingDeadline, resolutionDeadline, ...]
    stakingDeadline = deluluData[4] as bigint;
    resolutionDeadline = deluluData[5] as bigint;
  } else {
    // If returned as object with named properties
    const market = deluluData as {
      id: bigint;
      creator: `0x${string}`;
      token: `0x${string}`;
      contentHash: string;
      stakingDeadline: bigint;
      resolutionDeadline: bigint;
      totalBelieverStake: bigint;
      totalDoubterStake: bigint;
      outcome: boolean;
      isResolved: boolean;
      isCancelled: boolean;
    };
    stakingDeadline = market.stakingDeadline;
    resolutionDeadline = market.resolutionDeadline;
  }

  return {
    stakingDeadline: stakingDeadline ? new Date(Number(stakingDeadline) * 1000) : null,
    resolutionDeadline: resolutionDeadline ? new Date(Number(resolutionDeadline) * 1000) : null,
    isLoading,
    error,
  };
}
