import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export enum DeluluState {
  Active = 0,
  StakingClosed = 1,
  Resolved = 2,
  Cancelled = 3,
}

export function useDeluluState(deluluId: number | null) {
  const chainId = useChainId();
  const {
    data: state,
    isLoading,
    error,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "getDeluluState",
    args: deluluId !== null ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null,
    },
  });

  return {
    state: state !== undefined ? (state as number) : null,
    stateEnum: state !== undefined ? (state as DeluluState) : null,
    isLoading,
    error,
  };
}

