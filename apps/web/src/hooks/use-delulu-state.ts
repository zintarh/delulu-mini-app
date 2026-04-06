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
    data: market,
    isLoading: isLoadingMarket,
    error: marketError,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "delulus",
    args: deluluId !== null && deluluId > 0 ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null && deluluId > 0,
    },
  });

  const {
    data: isFailed,
    isLoading: isLoadingFailed,
    error: failedError,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "marketIsFailed",
    args: deluluId !== null && deluluId > 0 ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null && deluluId > 0,
    },
  });

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const marketAny = market as Record<string, unknown> | undefined;
  const stakingDeadline = (marketAny?.stakingDeadline as bigint | undefined) ?? 0n;
  const resolutionDeadline = (marketAny?.resolutionDeadline as bigint | undefined) ?? 0n;
  const isResolved = Boolean(marketAny?.isResolved);

  let stateValue: number | null = null;
  if (marketAny && (marketAny.id as bigint | undefined) !== 0n) {
    if (Boolean(isFailed)) {
      stateValue = DeluluState.Cancelled;
    } else if (isResolved) {
      stateValue = DeluluState.Resolved;
    } else if (resolutionDeadline > 0n && nowSec >= resolutionDeadline) {
      stateValue = DeluluState.Review;
    } else if (stakingDeadline > 0n && nowSec >= stakingDeadline) {
      stateValue = DeluluState.Locked;
    } else {
      stateValue = DeluluState.Open;
    }
  }

  return {
    state: stateValue,
    stateEnum: stateValue !== null ? (stateValue as DeluluState) : null,
    isLoading: isLoadingMarket || isLoadingFailed,
    error: marketError || failedError,
  };
}

