import {
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useChainId } from "wagmi";
import { parseUnits } from "viem";
import { useState } from "react";
import { getDeluluContractAddress, isGoodDollarToken, isGoodDollarSupported } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { uploadToIPFS, type GatekeeperConfig } from "@/lib/ipfs";
import {
  withTimeout,
  getDefaultImageUrl,
  IPFS_UPLOAD_TIMEOUT,
} from "@/lib/create-delulu-helpers";


export function useCreateDelulu() {
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const createDelulu = async (
    tokenAddress: string,
    content: string,
    deadline: Date,
    amount: number,
    username?: string,
    pfpUrl?: string,
    gatekeeper?: GatekeeperConfig | null,
    bgImageUrl?: string,
    description?: string
  ) => {
    try {
      if (!tokenAddress || typeof tokenAddress !== "string" || !tokenAddress.startsWith("0x")) {
        throw new Error("Invalid token address");
      }

      if (isGoodDollarToken(tokenAddress) && !isGoodDollarSupported(chainId)) {
        throw new Error("G$ (GoodDollar) is only available on Celo Mainnet. Please switch to mainnet to create markets with G$.");
      }
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        throw new Error("Content cannot be empty");
      }
      if (!isFinite(amount) || isNaN(amount)) {
        throw new Error("Invalid stake amount");
      }
      if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
        throw new Error("Invalid deadline date");
      }

      const finalBgImageUrl = bgImageUrl || getDefaultImageUrl();
      const createdAt = new Date();

      let contentHash: string;
      try {
        contentHash = await withTimeout(
          uploadToIPFS(content, description, username, pfpUrl, createdAt, gatekeeper, finalBgImageUrl),
          IPFS_UPLOAD_TIMEOUT,
          "IPFS upload timed out"
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("timeout")) {
          throw new Error("Upload timed out. Please try again.");
        }
        throw error;
      }

      if (!contentHash || typeof contentHash !== "string") {
        throw new Error("Invalid IPFS hash returned");
      }

      const deadlineTimestamp = deadline.getTime();
      if (!isFinite(deadlineTimestamp) || deadlineTimestamp <= 0) {
        throw new Error("Invalid deadline timestamp");
      }

      const resolutionDeadline = BigInt(Math.floor(deadlineTimestamp / 1000));
      const now = BigInt(Math.floor(Date.now() / 1000));
      const GENESIS_24H = 24n * 60n * 60n;
      if (resolutionDeadline <= now + GENESIS_24H) {
        throw new Error("Resolution deadline must be at least 24 hours from now");
      }

      const stakingDeadline = 0n;

      let initialSupportWei = 0n;
      if (amount > 0) {
        let parsed;
        try {
          parsed = parseUnits(amount.toString(), 18);
        } catch {
          throw new Error("Invalid stake amount format");
        }
        const MIN_STAKE_WEI = 100n * (10n ** 18n);
        if (parsed < MIN_STAKE_WEI) {
          throw new Error("Minimum stake is 100 G$");
        }
        initialSupportWei = parsed;
      }

      const contractAddress = getDeluluContractAddress(chainId);

      setIsPending(true);
      setWriteError(null);
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "createDelulu",
        args: [
          tokenAddress as `0x${string}`,
          contentHash,
          stakingDeadline,
          resolutionDeadline,
          initialSupportWei,
        ],
      });
      setHash(txHash);
    } catch (error) {
      setWriteError(error instanceof Error ? error : new Error(String(error)));
      if (process.env.NODE_ENV === "development") {
        console.error("[DEV] Create delulu error:", error);
      }
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const error = writeError || receiptError;
  const isError = !!error;
  const errorMessage = error?.message || null;

  return {
    createDelulu,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError,
    errorMessage,
    isWalletPending: isPending,
    isConfirming,
  };
}
