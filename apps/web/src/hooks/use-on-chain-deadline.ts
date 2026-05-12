import { useReadContract } from "wagmi";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useOnChainDeadline(deluluId: number | null) {
  const {
    data: deluluData,
    isLoading,
    error,
  } = useReadContract({
    address: getDeluluContractAddress(DELULU_CHAIN_ID),
    abi: DELULU_ABI,
    chainId: DELULU_CHAIN_ID,
    functionName: "delulus",
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

  // Handle both tuple and object decode styles from viem/wagmi.
  const raw = deluluData as unknown;
  let stakingDeadline: bigint = 0n;
  let resolutionDeadline: bigint = 0n;

  if (Array.isArray(raw)) {
    // Market tuple layout in v3:
    // [id, creator, token, contentHash, stakingDeadline, resolutionDeadline, ...]
    stakingDeadline = (raw[4] as bigint) ?? 0n;
    resolutionDeadline = (raw[5] as bigint) ?? 0n;
  } else if (raw && typeof raw === "object") {
    const market = raw as Record<string, unknown>;
    stakingDeadline = (market.stakingDeadline as bigint) ?? 0n;
    resolutionDeadline = (market.resolutionDeadline as bigint) ?? 0n;
  }

  return {
    stakingDeadline: stakingDeadline ? new Date(Number(stakingDeadline) * 1000) : null,
    resolutionDeadline: resolutionDeadline ? new Date(Number(resolutionDeadline) * 1000) : null,
    isLoading,
    error,
  };
}
