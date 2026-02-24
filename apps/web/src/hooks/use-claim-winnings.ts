import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import { getDeluluContractAddress, isGoodDollarToken, isGoodDollarSupported } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useClaimWinnings() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const claim = (deluluId: number, amount: number, tokenAddress?: string) => {
    if (!deluluId) return;
    if (amount <= 0) {
      console.warn("[useClaimWinnings] Claim amount must be greater than 0");
      return;
    }

    // Validate: G$ is only supported on mainnet
    if (tokenAddress && isGoodDollarToken(tokenAddress) && !isGoodDollarSupported(chainId)) {
      throw new Error("G$ (GoodDollar) is only available on Celo Mainnet. Please switch to mainnet to claim G$ winnings.");
    }

    writeContract({
      address: getDeluluContractAddress(chainId),
      abi: DELULU_ABI,
      functionName: "claimWinnings",
      args: [deluluId],
    });
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}
