import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { type FormattedDelulu } from "./use-delulus";
import { api } from "@/lib/api-client";

/**
 * Fetch a single delulu by ID (supports both database ID and onChainId)
 */
export function useSingleDelulu(deluluId: string | number | null) {
  // Try to fetch from backend API first
  const {
    data: apiDelulu,
    isLoading: isLoadingApi,
    error: apiError,
  } = useQuery({
    queryKey: ["delulu", deluluId],
    queryFn: async () => {
      if (!deluluId) return null;
      return api.getDelulu(String(deluluId));
    },
    enabled: !!deluluId,
    staleTime: 30 * 1000,
  });

  // Fallback to contract if API fails and ID is numeric
  const numericId = typeof deluluId === "number" ? deluluId : 
                    typeof deluluId === "string" && /^\d+$/.test(deluluId) ? parseInt(deluluId) : null;
  
  const {
    data: contractDelulu,
    isLoading: isLoadingContract,
    error: contractError,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getDelulu",
    args: numericId !== null ? [BigInt(numericId)] : undefined,
    query: {
      enabled: numericId !== null && !apiDelulu && !isLoadingApi,
    },
  });

  // If we have API data, format and return it
  if (apiDelulu) {
    const formatted: FormattedDelulu = {
      id: parseInt(apiDelulu.onChainId) || 0,
      creator: apiDelulu.creatorAddress as `0x${string}`,
      contentHash: apiDelulu.contentHash,
      content: apiDelulu.content,
      stakingDeadline: new Date(apiDelulu.stakingDeadline),
      resolutionDeadline: new Date(apiDelulu.resolutionDeadline),
      totalBelieverStake: apiDelulu.totalBelieverStake,
      totalDoubterStake: apiDelulu.totalDoubterStake,
      totalStake: apiDelulu.totalStake,
      outcome: apiDelulu.outcome ?? false,
      isResolved: apiDelulu.isResolved,
      isCancelled: apiDelulu.isCancelled,
      username: apiDelulu.creator?.username,
      pfpUrl: apiDelulu.creator?.pfpUrl,
      bgImageUrl: apiDelulu.bgImageUrl,
      gatekeeper: apiDelulu.gatekeeperEnabled ? {
        enabled: true,
        type: (apiDelulu.gatekeeperType ?? "country") as "country",
        value: apiDelulu.gatekeeperValue ?? "",
        label: apiDelulu.gatekeeperLabel ?? "",
      } : undefined,
      createdAt: new Date(apiDelulu.createdAt),
    };

    return {
      delulu: formatted,
      isLoading: false,
      error: null,
    };
  }

  // If no contract data either, return loading or error state
  if (!contractDelulu) {
    return {
      delulu: null,
      isLoading: isLoadingApi || isLoadingContract,
      error: apiError || contractError,
    };
  }

  // Handle contract data (both array and object formats)
  const d = Array.isArray(contractDelulu)
    ? {
        id: contractDelulu[0],
        creator: contractDelulu[1],
        contentHash: contractDelulu[2],
        stakingDeadline: contractDelulu[3],
        resolutionDeadline: contractDelulu[4],
        totalBelieverStake: contractDelulu[5],
        totalDoubterStake: contractDelulu[6],
        outcome: contractDelulu[7],
        isResolved: contractDelulu[8],
        isCancelled: contractDelulu[9],
      }
    : (contractDelulu as {
        id: bigint;
        creator: `0x${string}`;
        contentHash: string;
        stakingDeadline: bigint;
        resolutionDeadline: bigint;
        totalBelieverStake: bigint;
        totalDoubterStake: bigint;
        outcome: boolean;
        isResolved: boolean;
        isCancelled: boolean;
      });

  const believerStake = parseFloat(formatUnits(d.totalBelieverStake, 18));
  const doubterStake = parseFloat(formatUnits(d.totalDoubterStake, 18));
  const totalStake = believerStake + doubterStake;

  const formatted: FormattedDelulu = {
    id: Number(d.id),
    creator: d.creator,
    contentHash: d.contentHash,
    stakingDeadline: new Date(Number(d.stakingDeadline) * 1000),
    resolutionDeadline: new Date(Number(d.resolutionDeadline) * 1000),
    totalBelieverStake: believerStake,
    totalDoubterStake: doubterStake,
    totalStake,
    outcome: d.outcome,
    isResolved: d.isResolved,
    isCancelled: d.isCancelled,
  };

  return {
    delulu: formatted,
    isLoading: false,
    error: null,
  };
}

