import { useReadContract, useChainId } from "wagmi";
import { useAccount } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useClaimable(deluluId: number | null) {
  const { address } = useAccount();
  const chainId = useChainId();
  const {
    data: claimable,
    isLoading,
    error,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "isClaimable",
    args: deluluId !== null && address ? [deluluId, address] : undefined,
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
