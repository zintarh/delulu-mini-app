import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export interface Delulu {
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
}

export interface FormattedDelulu {
  id: number;
  creator: string;
  contentHash: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalStake: number;
  outcome: boolean;
  isResolved: boolean;
  isCancelled: boolean;
}

export function useDelulus() {
  const { data, isLoading, error } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getDelulus",
  });

  console.log("=== useDelulus Hook Debug ===");
  console.log("Contract Address:", DELULU_CONTRACT_ADDRESS);
  console.log("Raw Data:", data);
  console.log("Is Loading:", isLoading);
  console.log("Error:", error);
  console.log("Data Type:", typeof data);
  console.log("Is Array:", Array.isArray(data));
  if (data) {
    console.log("Data Length:", (data as any)?.length);
    console.log("First Item:", (data as any)?.[0]);
  }
  console.log("============================");

  const delulus: FormattedDelulu[] = data
    ? (data as Delulu[])
        .filter((d) => !d.isCancelled)
        .map((d) => {
          const formatted = {
            id: Number(d.id),
            creator: d.creator,
            contentHash: d.contentHash,
            stakingDeadline: new Date(Number(d.stakingDeadline) * 1000),
            resolutionDeadline: new Date(Number(d.resolutionDeadline) * 1000),
            totalBelieverStake: parseFloat(formatUnits(d.totalBelieverStake, 18)),
            totalDoubterStake: parseFloat(formatUnits(d.totalDoubterStake, 18)),
            totalStake:
              parseFloat(formatUnits(d.totalBelieverStake, 18)) +
              parseFloat(formatUnits(d.totalDoubterStake, 18)),
            outcome: d.outcome,
            isResolved: d.isResolved,
            isCancelled: d.isCancelled,
          };
          console.log("Formatted Delulu:", formatted);
          return formatted;
        })
        .sort((a, b) => b.totalStake - a.totalStake)
    : [];

  console.log("Final Delulus Array:", delulus);
  console.log("Delulus Count:", delulus.length);

  return { delulus, isLoading, error };
}

