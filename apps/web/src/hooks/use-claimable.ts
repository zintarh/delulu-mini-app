import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useClaimable(deluluId: number | null) {
  const { address } = useAccount();
  const {
    data: claimable,
    isLoading,
    error,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "isClaimable",
    args:
      deluluId !== null && address ? [BigInt(deluluId), address] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  return {
    isClaimable: claimable === true,
    isLoading,
    error,
  };
}

