import { useReadContract, useChainId } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserClaimableAmount(deluluId: number | null) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);

  const {
    data: userPosition,
    isLoading: isLoadingPosition,
    error: positionError,
  } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "getUserPosition",
    args:
      deluluId !== null && address ? [BigInt(deluluId), address] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });





  const {
    data: potentialAmount,
    isLoading: isLoadingPotential,
    error: potentialError,
  } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "getClaimableAmount",
    args:
      deluluId !== null && address
        ? [BigInt(deluluId), address]
        : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });



  const claimableAmount = potentialAmount
    ? parseFloat(formatUnits(potentialAmount as bigint, 18))
    : 0;



  return {
    claimableAmount,
    isLoading: isLoadingPosition || isLoadingPotential,
    error: positionError || potentialError,
  };
}
