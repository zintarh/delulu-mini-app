import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useUserPosition(deluluId: number | null) {
  const { address } = useAccount();
  const {
    data: userPosition,
    isLoading,
    error,
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

  if (!userPosition) {
    return {
      hasStaked: false,
      stakeAmount: 0,
      isBeliever: false,
      isClaimed: false,
      isLoading,
      error,
    };
  }

  // userPosition is a struct returned as an object with named properties
  // or as an array tuple depending on how Viem decodes it
  let amount: bigint;
  let side: boolean;
  let claimed: boolean;

  if (Array.isArray(userPosition)) {
    // If returned as array tuple
    [amount, side, claimed] = userPosition as [bigint, boolean, boolean];
  } else {
    // If returned as object with named properties
    const pos = userPosition as { amount: bigint; side: boolean; claimed: boolean };
    amount = pos.amount;
    side = pos.side;
    claimed = pos.claimed;
  }

  const stakeAmount = parseFloat(formatUnits(amount, 18));

  return {
    hasStaked: amount > 0n,
    stakeAmount,
    isBeliever: side,
    isClaimed: claimed,
    isLoading,
    error,
  };
}
