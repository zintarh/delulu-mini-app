import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserTotalStaked(deluluId: number | null) {
  const { address } = useAccount();
  const {
    data: totalStaked,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "userTotalStaked",
    args:
      deluluId !== null && address ? [BigInt(deluluId), address] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  return {
    totalStaked: totalStaked
      ? parseFloat(formatUnits(totalStaked as bigint, 18))
      : 0,
    isLoading,
    error,
  };
}

