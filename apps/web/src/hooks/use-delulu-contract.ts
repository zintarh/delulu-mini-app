import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConfig,
} from "wagmi";
import { parseUnits, createPublicClient, http } from "viem";
import { celo, celoSepolia } from "viem/chains";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { uploadToIPFS, type GatekeeperConfig } from "@/lib/ipfs";
import {
  withTimeout,
  getDefaultImageUrl,
  IPFS_UPLOAD_TIMEOUT,
} from "@/lib/create-delulu-helpers";

// External fetcher function for syncing transaction to backend
async function syncTransactionToBackend(
  txHash: string,
  deluluId: bigint
): Promise<void> {
  // Validate txHash before sending
  if (!txHash || typeof txHash !== "string") {
    throw new Error("Invalid transaction hash");
  }

  // Validate txHash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("Invalid transaction hash format");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30s timeout

    let response;
    try {
      response = await fetch("/api/sync/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txHash, deluluId: deluluId.toString() }),
        signal: controller.signal,
      });
      // Clear timeout on successful fetch
      clearTimeout(timeoutId);
    } catch (fetchError) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error(
        `Network error: ${
          fetchError instanceof Error ? fetchError.message : "Unknown error"
        }`
      );
    }

    if (!response) {
      throw new Error("No response received from server");
    }

    let data;
    try {
      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response from server");
      }
      data = JSON.parse(responseText);
    } catch (jsonError) {
      if (!response.ok) {
        throw new Error(
          `Failed to sync transaction: ${response.status} ${response.statusText}`
        );
      }
      throw new Error("Invalid response format from server");
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Failed to sync transaction: ${response.status} ${response.statusText}`
      );
    }

    if (!data || typeof data !== "object" || !data.success) {
      throw new Error(
        data?.error || "Backend sync returned unsuccessful status"
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

export function useCreateDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const config = useConfig();

  // Store deluluId that will be created (read before creation)
  const pendingDeluluIdRef = useRef<bigint | null>(null);

  const syncMutation = useMutation({
    mutationFn: ({ txHash, deluluId }: { txHash: string; deluluId: bigint }) =>
      syncTransactionToBackend(txHash, deluluId),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const lastSyncedHash = useRef<string | null>(null);

  const previousHash = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (hash && hash !== previousHash.current) {
      previousHash.current = hash;
      if (lastSyncedHash.current !== null) {
        lastSyncedHash.current = null;
      }
    }
  }, [hash]);

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receiptData,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    const txHash = receiptData?.transactionHash;
    const deluluId = pendingDeluluIdRef.current;

    if (
      isSuccess &&
      txHash &&
      deluluId !== null &&
      deluluId !== undefined &&
      deluluId > 0n &&
      txHash !== lastSyncedHash.current &&
      !syncMutation.isSuccess &&
      !syncMutation.isPending
    ) {
      lastSyncedHash.current = txHash;
      syncMutation.mutate({ txHash, deluluId });
      pendingDeluluIdRef.current = null;
    } else if (
      isSuccess &&
      txHash &&
      (deluluId === null || deluluId === undefined || deluluId === 0n)
    ) {
      console.error(
        "[useCreateDelulu] CRITICAL: Transaction succeeded but deluluId is missing. Sync will not proceed.",
        { txHash, deluluId }
      );
    }
  }, [
    isSuccess,
    receiptData?.transactionHash,
    syncMutation.isSuccess,
    syncMutation.isPending,
  ]);

  const createDelulu = async (
    content: string,
    deadline: Date,
    amount: number,
    username?: string,
    pfpUrl?: string,
    gatekeeper?: GatekeeperConfig | null,
    bgImageUrl?: string
  ) => {
    try {
      if (process.env.NODE_ENV === "development") {
     

        if (!process.env.NEXT_PUBLIC_RPC_URL) {
          console.warn("[DEV] NEXT_PUBLIC_RPC_URL not set");
        }
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

      // Validate deadline
      if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
        throw new Error("Invalid deadline date");
      }

      // Use helper for default image URL
      const finalBgImageUrl = bgImageUrl || getDefaultImageUrl();

      const createdAt = new Date();

      // Upload to IPFS with timeout protection
      let contentHash: string;
      try {
        contentHash = await withTimeout(
          uploadToIPFS(
            content,
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

      // Calculate deadlines with validation
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

      // Validate and parse amount
      if (!isFinite(amount) || amount <= 0) {
        throw new Error("Stake amount must be greater than 0");
      }

      let amountWei;
      try {
        amountWei = parseUnits(amount.toString(), 18);
      } catch (parseError) {
        throw new Error("Invalid stake amount format");
      }

      if (amountWei <= 0n) {
        throw new Error("Stake amount must be greater than 0");
      }

      if (!config) {
        throw new Error("Wagmi config not available. Cannot read deluluId.");
      }

      // Create a public client to read from the contract
      const chain = config.chains[0] || celo;
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
      if (!rpcUrl) {
        throw new Error(
          "NEXT_PUBLIC_RPC_URL not configured. Cannot read deluluId."
        );
      }

      let nextDeluluId: bigint;
      try {
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl, { timeout: 30000 }),
        });

        nextDeluluId = (await publicClient.readContract({
          address: DELULU_CONTRACT_ADDRESS,
          abi: DELULU_ABI,
          functionName: "nextDeluluId",
        })) as bigint;
      } catch (readError) {
        console.error(
          "[useCreateDelulu] Failed to read nextDeluluId:",
          readError
        );
        throw new Error(
          `Failed to read deluluId from contract: ${
            readError instanceof Error ? readError.message : "Unknown error"
          }`
        );
      }

      if (
        !nextDeluluId ||
        nextDeluluId === 0n ||
        !isFinite(Number(nextDeluluId))
      ) {
        console.error(
          "[useCreateDelulu] Invalid nextDeluluId read:",
          nextDeluluId
        );
        throw new Error(
          `Invalid deluluId read from contract: ${
            nextDeluluId?.toString() || "null"
          }. Creation terminated.`
        );
      }

      pendingDeluluIdRef.current = nextDeluluId;


      // Create the delulu
      writeContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "createDelulu",
        args: [contentHash, stakingDeadline, resolutionDeadline, amountWei],
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

  const isTotalPending = isPending || isConfirming || syncMutation.isPending;
  const isFullyComplete = isSuccess && syncMutation.isSuccess;
  const isTotalError = !!error || !!receiptError || syncMutation.isError;

  const totalErrorMessage =
    error?.message ||
    receiptError?.message ||
    syncMutation.error?.message ||
    null;

  return {
    createDelulu,
    hash,
    // Unified states
    isPending: isTotalPending,
    isSuccess: isFullyComplete,
    isError: isTotalError,
    errorMessage: totalErrorMessage,
    // Individual states for granular UI usage (optional)
    isWalletPending: isPending,
    isConfirming,
    isBlockchainSuccess: isSuccess,
    backendSyncStatus: syncMutation.status,
    // Legacy compatibility (can be removed in future)
    backendSyncError: syncMutation.error?.message || null,
    isBackendSyncing: syncMutation.isPending,
    isFullyComplete,
  };
}
