import { useReadContract, useChainId } from "wagmi";
import { useAccount } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useIsAdmin() {
  const { address } = useAccount();
  const chainId = useChainId();
  const {
    data: owner,
    isLoading,
    error,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "owner",
    query: {
      enabled: !!address,
    },
  });

  const isAdmin = address && owner
    ? address.toLowerCase() === (owner as string).toLowerCase()
    : false;

  return {
    isAdmin,
    isLoading,
    error,
  };
}
