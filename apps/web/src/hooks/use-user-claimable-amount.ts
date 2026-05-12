import { useReadContract, useChainId } from "wagmi";
import { formatUnits, isAddress, zeroAddress } from "viem";
import {
  CELO_MAINNET_ID,
  DELULU_CHAIN_ID,
  getDeluluContractAddress,
} from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useAuth } from "@/hooks/use-auth";
import { formatAddress } from "@/lib/utils";
import { normalizeDeluluMarketRead } from "@/lib/delulu-market-read";

export function useUserClaimableAmount(deluluId: number | null) {
  const { address } = useAuth();
  const walletChainId = useChainId();
  const contractAddress = getDeluluContractAddress(DELULU_CHAIN_ID);
  const marketId = deluluId !== null ? BigInt(deluluId) : null;

  const readBase = {
    address: contractAddress,
    abi: DELULU_ABI,
    chainId: DELULU_CHAIN_ID,
  } as const;

  // Read the full market struct
  const { data: market, isLoading: isLoadingMarket, error: marketError } = useReadContract({
    ...readBase,
    functionName: "delulus",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  // Read the staked amount (creator's initial stake, tracked separately from tips)
  const { data: stakedAmount, isLoading: isLoadingStake, error: stakeError } = useReadContract({
    ...readBase,
    functionName: "marketStakedAmount",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  // Check if market has failed
  const {
    data: marketIsFailed,
    isLoading: isLoadingMarketFailed,
    error: marketFailedError,
  } = useReadContract({
    ...readBase,
    functionName: "marketIsFailed",
    args: marketId !== null ? [marketId] : undefined,
    query: { enabled: marketId !== null && !!address },
  });

  // Get protocol fee percentage
  const { data: feeBps, isLoading: isLoadingFeeBps, error: feeBpsError } = useReadContract({
    ...readBase,
    functionName: "PROTOCOL_FEE_BPS",
    query: { enabled: marketId !== null && !!address },
  });

  // Get BPS denominator for fee calculation
  const {
    data: bpsDenominator,
    isLoading: isLoadingBpsDenominator,
    error: bpsDenominatorError,
  } = useReadContract({
    ...readBase,
    functionName: "BPS_DENOMINATOR",
    query: { enabled: marketId !== null && !!address },
  });

  // Extract market data (tuple array vs struct object — see normalizeDeluluMarketRead)
  const marketAny = normalizeDeluluMarketRead(market);
  const creatorRaw = marketAny?.creator as string | undefined;
  const creator = creatorRaw?.toLowerCase();
  const isCreator = !!address && creator === address.toLowerCase();
  const marketStructId = marketAny?.id as bigint | undefined;
  const marketMissingOrEmpty =
    marketStructId === undefined ||
    marketStructId === 0n ||
    !creatorRaw ||
    creatorRaw.toLowerCase() === zeroAddress;
  const resolutionDeadline = (marketAny?.resolutionDeadline as bigint | undefined) ?? 0n;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  // Match Delulu-v3.claimPersonalMarketSupport: reverts only when block.timestamp < resolutionDeadline.
  // When deadline is 0, timestamp < 0 is false, so the market is treated as past resolution for that check.
  const isDurationOver =
    resolutionDeadline === 0n || nowSec >= resolutionDeadline;
  const rewardClaimed = Boolean(marketAny?.rewardClaimed);
  const isFailed = Boolean(marketIsFailed);
  const milestoneCount = (marketAny?.milestoneCount as bigint | undefined) ?? 0n;
  // On-chain: totalSupportCollected = tips only; creator stake is marketStakedAmount (matches claim payout).
  const totalSupportCollected = (marketAny?.totalSupportCollected as bigint | undefined) ?? 0n;

  const payoutPrerequisites =
    isCreator &&
    isDurationOver &&
    !isFailed &&
    !rewardClaimed &&
    stakedAmount !== undefined &&
    typeof stakedAmount === "bigint" &&
    typeof feeBps === "bigint" &&
    typeof bpsDenominator === "bigint" &&
    bpsDenominator > 0n;

  let claimableAmount = 0;
  let payoutWei = 0n;
  if (payoutPrerequisites) {
    const fee = (totalSupportCollected * feeBps) / bpsDenominator;
    payoutWei = totalSupportCollected - fee + stakedAmount;
    claimableAmount = parseFloat(formatUnits(payoutWei, 18));
  }

  /** True when the connected wallet may call claimPersonalMarketSupport and expect a non-zero payout (RPC-only, no subgraph). */
  const canAttemptClaimOnChain = payoutPrerequisites && payoutWei > 0n;

  const isLoading =
    isLoadingMarket ||
    isLoadingStake ||
    isLoadingMarketFailed ||
    isLoadingFeeBps ||
    isLoadingBpsDenominator;

  const readError =
    marketError ||
    stakeError ||
    marketFailedError ||
    feeBpsError ||
    bpsDenominatorError;

  let creatorClaimHint: string | null = null;
  if (marketId !== null && !isLoading) {
    if (readError) {
      creatorClaimHint =
        "Could not load on-chain market data. Check your connection and refresh.";
    } else if (marketMissingOrEmpty) {
      creatorClaimHint =
        "No market found at this ID on Celo. Check the URL uses the correct on-chain delulu id.";
    } else if (address && creator && !isCreator) {
      creatorClaimHint = `Only the creator wallet can claim. On-chain creator: ${isAddress(creatorRaw as `0x${string}`) ? formatAddress(creatorRaw as `0x${string}`) : creatorRaw}.`;
    } else if (isCreator) {
      if (!isDurationOver) {
        creatorClaimHint =
          "Claim unlocks after the on-chain resolution deadline. The amount in the header can include your stake plus tips from the indexer; the figure here uses live contract balances.";
      } else if (isFailed) {
        creatorClaimHint =
          "This goal was marked as failed on-chain. Creator rewards are not available through this claim.";
      } else if (rewardClaimed) {
        creatorClaimHint = "The creator payout for this delulu was already claimed on-chain.";
      } else if (claimableAmount <= 0) {
        creatorClaimHint =
          "On-chain payout is zero (no tips + stake in the contract for this market, or liquidity guard).";
      } else if (walletChainId !== CELO_MAINNET_ID) {
        creatorClaimHint =
          "Switch your wallet to Celo mainnet to confirm the claim transaction (balances above already use Celo).";
      }
    }
  }

  return {
    claimableAmount,
    isLoading,
    error: readError,
    creatorClaimHint,
    /** Creator per `delulus(deluluId).creator` — same check the contract uses for claim. */
    isWalletMarketCreator: isCreator,
    /** `block.timestamp >= resolutionDeadline` (and deadline 0 treated like the contract). */
    onChainResolutionReached: isDurationOver,
    canAttemptClaimOnChain,
    // Debug info for troubleshooting
    _debug: {
      stakedAmount,
      totalSupportCollected,
      rewardClaimed,
      isFailed,
      isCreator,
      isDurationOver,
      feeBps,
      bpsDenominator,
      milestoneCount,
      payoutWei,
    },
  };
}
