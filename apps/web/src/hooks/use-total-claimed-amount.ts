import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useTotalClaimedAmount() {
  const { address } = useAccount();

  const {
    data: totalClaimed,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getTotalClaimedAmount",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    totalClaimed: totalClaimed
      ? parseFloat(formatUnits(totalClaimed as bigint, 18))
      : 0,
    isLoading,
    error,
  };
}

