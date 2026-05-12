import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useAuth } from "@/hooks/use-auth";
import { normalizeDeluluMarketRead } from "@/lib/delulu-market-read";

export function useUserPosition(deluluId: number | null) {
  const { address } = useAuth();
  const addr = getDeluluContractAddress(DELULU_CHAIN_ID);
  const readBase = { address: addr, abi: DELULU_ABI, chainId: DELULU_CHAIN_ID } as const;
  const {
    data: shareBalance,
    isLoading: isLoadingShares,
    error: sharesError,
  } = useReadContract({
    ...readBase,
    functionName: "shareBalance",
    args:
      deluluId !== null && address ? [BigInt(deluluId), address] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  const {
    data: market,
    isLoading: isLoadingMarket,
    error: marketError,
  } = useReadContract({
    ...readBase,
    functionName: "delulus",
    args: deluluId !== null ? [BigInt(deluluId)] : undefined,
    query: {
      enabled: deluluId !== null && !!address,
    },
  });

  if (typeof shareBalance !== "bigint") {
    return {
      hasStaked: false,
      stakeAmount: 0,
      isBeliever: true,
      isClaimed: false,
      isLoading: isLoadingShares || isLoadingMarket,
      error: sharesError || marketError,
    };
  }

  const stakeAmount = parseFloat(formatUnits(shareBalance, 18));
  const marketAny = normalizeDeluluMarketRead(market);
  const creator = (marketAny?.creator as string | undefined)?.toLowerCase();
  const isCreator = !!address && creator === address.toLowerCase();
  const isClaimed = isCreator ? Boolean(marketAny?.rewardClaimed) : false;

  return {
    hasStaked: shareBalance > 0n,
    stakeAmount,
    isBeliever: true,
    isClaimed,
    isLoading: isLoadingShares || isLoadingMarket,
    error: sharesError || marketError,
  };
}
