import { useReadContract } from "wagmi";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { normalizeDeluluMarketRead } from "@/lib/delulu-market-read";

export enum DeluluState {
  Open = 0,
  Locked = 1,
  Review = 2,
  Resolved = 3,
  Cancelled = 4,
}

export function useDeluluState(deluluId: number | null) {
  const addr = getDeluluContractAddress(DELULU_CHAIN_ID);
  const readBase = { address: addr, abi: DELULU_ABI, chainId: DELULU_CHAIN_ID } as const;
  const {
    data: market,
    isLoading: isLoadingMarket,
    error: marketError,
  } = useReadContract({
    ...readBase,
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
    ...readBase,
    functionName: "marketIsFailed",
    args: deluluId !== null && deluluId > 0 ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null && deluluId > 0,
    },
  });

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const marketAny = normalizeDeluluMarketRead(market);
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

