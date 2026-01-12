import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserClaimableAmount(deluluId: number | null) {
  const { address } = useAccount();

  const {
    data: userPosition,
    isLoading: isLoadingPosition,
    error: positionError,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUserPosition",
    args:
      deluluId !== null && address ? [BigInt(deluluId), address] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  const position = userPosition as
    | { amount: bigint; side: boolean; claimed: boolean }
    | undefined;

  const userStakeAmount = position?.amount
    ? parseFloat(formatUnits(position.amount, 18))
    : 0;
  const userSide = position?.side ?? null;

  const {
    data: potentialAmount,
    isLoading: isLoadingPotential,
    error: potentialError,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
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
