import { useReadContract, useChainId, useAccount } from "wagmi";
import { formatUnits } from "viem";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserClaimableAmount(deluluId: number | null) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getDeluluContractAddress(chainId);
  const marketId = deluluId !== null ? BigInt(deluluId) : null;

  const { data: market, isLoading: isLoadingMarket, error: marketError } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "delulus",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  const { data: isFailed, isLoading: isLoadingFailed, error: failedError } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "marketIsFailed",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  const { data: stakedAmount, isLoading: isLoadingStake, error: stakeError } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "marketStakedAmount",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  const { data: feeBps, isLoading: isLoadingFeeBps, error: feeBpsError } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "PROTOCOL_FEE_BPS",
    query: { enabled: marketId !== null && !!address },
  });

  const {
    data: bpsDenominator,
    isLoading: isLoadingBpsDenominator,
    error: bpsDenominatorError,
  } = useReadContract({
    address: contractAddress,
    abi: DELULU_ABI,
    functionName: "BPS_DENOMINATOR",
    query: { enabled: marketId !== null && !!address },
  });

  const marketAny = market as Record<string, unknown> | undefined;
  const creator = (marketAny?.creator as string | undefined)?.toLowerCase();
  const isCreator = !!address && creator === address.toLowerCase();
  const isResolved = Boolean(marketAny?.isResolved);
  const rewardClaimed = Boolean(marketAny?.rewardClaimed);
  const totalSupportCollected =
    (marketAny?.totalSupportCollected as bigint | undefined) ?? 0n;

  let claimableAmount = 0;
  if (
    isCreator &&
    isResolved &&
    !Boolean(isFailed) &&
    !rewardClaimed &&
    typeof stakedAmount === "bigint" &&
    typeof feeBps === "bigint" &&
    typeof bpsDenominator === "bigint" &&
    bpsDenominator > 0n
  ) {
    const fee = (totalSupportCollected * feeBps) / bpsDenominator;
    const payout = totalSupportCollected - fee + stakedAmount;
    claimableAmount = parseFloat(formatUnits(payout, 18));
  }

  return {
    claimableAmount,
    isLoading:
      isLoadingMarket ||
      isLoadingFailed ||
      isLoadingStake ||
      isLoadingFeeBps ||
      isLoadingBpsDenominator,
    error:
      marketError ||
      failedError ||
      stakeError ||
      feeBpsError ||
      bpsDenominatorError,
  };
}
