import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export enum DeluluState {
  Open = 0,
  Locked = 1,
  Review = 2,
  Resolved = 3,
  Cancelled = 4,
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
    args: deluluId !== null && deluluId > 0 ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null && deluluId > 0,
    },
  });

  // Convert BigInt to number if needed (state is always a number 0-4)
  const stateValue = state !== undefined && state !== null 
    ? Number(state) 
    : null;

  return {
    state: stateValue,
    stateEnum: stateValue !== null ? (stateValue as DeluluState) : null,
    isLoading,
    error,
  };
}

