import { useReadContract } from "wagmi";
import { DELULU_CHAIN_ID, getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useAuth } from "@/hooks/use-auth";
import { normalizeDeluluMarketRead } from "@/lib/delulu-market-read";

export function useUserPosition(deluluId: number | null) {
  const { address } = useAuth();
  const addr = getDeluluContractAddress(DELULU_CHAIN_ID);
  const readBase = { address: addr, abi: DELULU_ABI, chainId: DELULU_CHAIN_ID } as const;

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

  const marketAny = normalizeDeluluMarketRead(market);
  const creator = (marketAny?.creator as string | undefined)?.toLowerCase();
  const isCreator = !!address && creator === address.toLowerCase();
  const isClaimed = isCreator ? Boolean(marketAny?.rewardClaimed) : false;

  return {
    isClaimed,
    isLoading: isLoadingMarket,
    error: marketError ?? null,
  };
}
