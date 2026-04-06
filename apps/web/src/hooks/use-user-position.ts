import { useReadContract, useChainId } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserPosition(deluluId: number | null) {
  const { address } = useAccount();
  const chainId = useChainId();
  const {
    data: shareBalance,
    isLoading: isLoadingShares,
    error: sharesError,
  } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
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
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
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
  const marketAny = market as Record<string, unknown> | undefined;
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
