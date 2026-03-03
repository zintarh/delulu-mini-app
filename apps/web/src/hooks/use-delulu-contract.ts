import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useChainId } from "wagmi";
import { parseUnits } from "viem";
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
  const { writeContract, data: hash, isPending, error } = useWriteContract();

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

      // Validate: G$ is only supported on mainnet
      if (isGoodDollarToken(tokenAddress) && !isGoodDollarSupported(chainId)) {
        throw new Error("G$ (GoodDollar) is only available on Celo Mainnet. Please switch to mainnet to create markets with G$.");
      }
      if (
        !content ||
        typeof content !== "string" ||
        content.trim().length === 0
      ) {
        throw new Error("Content cannot be empty");
      }
      if (!isFinite(amount) || isNaN(amount) || amount <= 0) {
        throw new Error("Stake amount must be greater than 0");
      }
      if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
        throw new Error("Invalid deadline date");
      }

      const finalBgImageUrl = bgImageUrl || getDefaultImageUrl();
      const createdAt = new Date();

      let contentHash: string;
      try {
        contentHash = await withTimeout(
          uploadToIPFS(
            content,
            description,
            username,
            pfpUrl,
            createdAt,
            gatekeeper,
            finalBgImageUrl
          ),
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

      const stakingDeadline = BigInt(Math.floor(deadlineTimestamp / 1000));
      const HOURS_24 = 24 * 60 * 60;
      const resolutionDeadline = stakingDeadline + BigInt(HOURS_24);

      const now = BigInt(Math.floor(Date.now() / 1000));
      if (stakingDeadline <= now) {
        throw new Error("Deadline must be in the future");
      }

      let amountWei;
      try {
        amountWei = parseUnits(amount.toString(), 18);
      } catch {
        throw new Error("Invalid stake amount format");
      }

      if (amountWei <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }

      const contractAddress = getDeluluContractAddress(chainId);

      // Use standard Wagmi writeContract
      writeContract({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "createDelulu",
        args: [tokenAddress as `0x${string}`, contentHash, stakingDeadline, resolutionDeadline, amountWei],
      });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[DEV] Create delulu error:", {
          error,
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            contentLength: content?.length ?? 0,
            amount,
            deadline:
              deadline instanceof Date ? deadline.toISOString() : "invalid",
          },
        });
      }
      throw error;
    }
  };

  const isError = !!error || !!receiptError;
  const errorMessage = error?.message || receiptError?.message || null;

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
