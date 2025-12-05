import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { type FormattedDelulu } from "./use-delulus";

export function useSingleDelulu(deluluId: number | null) {
  const {
    data: delulu,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getDelulu",
    args: deluluId !== null ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null,
    },
  });

  if (!delulu) {
    return {
      delulu: null,
      isLoading,
      error,
    };
  }

  // Handle both array and object formats
  const d = Array.isArray(delulu)
    ? {
        id: delulu[0],
        creator: delulu[1],
        contentHash: delulu[2],
        stakingDeadline: delulu[3],
        resolutionDeadline: delulu[4],
        totalBelieverStake: delulu[5],
        totalDoubterStake: delulu[6],
        outcome: delulu[7],
        isResolved: delulu[8],
        isCancelled: delulu[9],
      }
    : (delulu as {
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
    isLoading,
    error,
  };
}

