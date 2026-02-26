import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

/**
 * Hook to fetch username from contract by address
 */
export function useUsernameByAddress(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const {
    data: username,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    username: typeof username === "string" ? username : undefined,
    isLoading,
    error,
    refetch,
  };
}
