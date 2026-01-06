import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseUnits, decodeEventLog } from "viem";
import { useEffect, useRef, useState } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { uploadToIPFS, type GatekeeperConfig } from "@/lib/ipfs";
import { useBackendSync } from "./use-backend-sync";

interface CreateParams {
  content: string;
  contentHash: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  gatekeeper?: GatekeeperConfig | null;
  bgImageUrl: string;
  stakeAmount: number; 
}

export function useCreateDelulu() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({ hash });
  const { syncDelulu, syncUser, syncStake } = useBackendSync();
  const publicClient = usePublicClient();

  const [backendSyncStatus, setBackendSyncStatus] = useState<"idle" | "syncing" | "success" | "failed">("idle");
  const [backendSyncError, setBackendSyncError] = useState<string | null>(null);
  const pendingCreate = useRef<CreateParams | null>(null);
  useEffect(() => {
    async function syncAfterSuccess() {
      if (!isSuccess || !hash || !pendingCreate.current || !publicClient) return;

      setBackendSyncStatus("syncing");
      setBackendSyncError(null);

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash });
        
        let onChainId: string | undefined;
        
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: DELULU_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "DeluluCreated" && decoded.args) {
              const args = decoded.args as unknown as { id: bigint };
              onChainId = args.id.toString();
              break;
            }
          } catch {
            
          }
        }

        if (!onChainId) {
          throw new Error("Could not find onChainId from transaction");
        }

        const { content, contentHash, stakingDeadline, resolutionDeadline, gatekeeper, bgImageUrl, stakeAmount } =
          pendingCreate.current;

        const userResult = await syncUser();
        if (!userResult) {
          throw new Error("Failed to sync user to backend");
        }

        console.log(onChainId)

        const deluluResult = await syncDelulu({
          onChainId,
          contentHash,
          content,
          stakingDeadline,
          resolutionDeadline,
          bgImageUrl,
          gatekeeper: gatekeeper
            ? {
                enabled: gatekeeper.enabled,
                type: gatekeeper.type,
                value: gatekeeper.value,
                label: gatekeeper.label,
              }
            : undefined,
        });

        if (!deluluResult) {
          throw new Error("Failed to sync delulu to backend");
        }

        // Sync the initial stake (creator stakes as believer)
        if (stakeAmount > 0) {
          await syncStake({
            deluluId: onChainId,
            amount: stakeAmount,
            side: true, // Creator is always a believer
            txHash: hash,
          });
        }

        setBackendSyncStatus("success");
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Backend sync failed";
        console.error("Failed to sync delulu to backend:", err);
        setBackendSyncError(errorMsg);
        setBackendSyncStatus("failed");
      }

      pendingCreate.current = null;
    }

    syncAfterSuccess();
  }, [isSuccess, hash, publicClient, syncDelulu, syncUser, syncStake]);

  const createDelulu = async (
    content: string,
    deadline: Date,
    amount: number,
    username?: string,
    pfpUrl?: string,
    gatekeeper?: GatekeeperConfig | null,
    bgImageUrl?: string
  ) => {
    // Reset backend sync state
    setBackendSyncStatus("idle");
    setBackendSyncError(null);

    // Use default template if no bgImageUrl provided
    const finalBgImageUrl = bgImageUrl || `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/templates/t0.png`;

    const createdAt = new Date();
    const contentHash = await uploadToIPFS(content, username, pfpUrl, createdAt, gatekeeper, finalBgImageUrl);

    if (!contentHash || typeof contentHash !== "string") {
      throw new Error("Invalid IPFS hash returned");
    }

    const stakingDeadline = BigInt(Math.floor(deadline.getTime() / 1000));
    const HOURS_24 = 24 * 60 * 60;
    const resolutionDeadline = stakingDeadline + BigInt(HOURS_24);

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (stakingDeadline <= now) {
      throw new Error("Deadline must be in the future");
    }

    const amountWei = parseUnits(amount.toString(), 18);
    if (amountWei <= 0n) {
      throw new Error("Stake amount must be greater than 0");
    }

    // Store for backend sync
    pendingCreate.current = {
      content,
      contentHash,
      stakingDeadline: deadline,
      resolutionDeadline: new Date(Number(resolutionDeadline) * 1000),
      gatekeeper,
      bgImageUrl: finalBgImageUrl,
      stakeAmount: amount, // Include initial stake amount
    };

    writeContract({
      address: DELULU_CONTRACT_ADDRESS,
      abi: DELULU_ABI,
      functionName: "createDelulu",
      args: [contentHash, stakingDeadline, resolutionDeadline, amountWei],
    });
  };

  return { 
    createDelulu, 
    hash, 
    isPending, 
    isConfirming, 
    isSuccess, 
    error: error || receiptError,
    backendSyncStatus,
    backendSyncError,
    isBackendSyncing: backendSyncStatus === "syncing",
    isFullyComplete: isSuccess && backendSyncStatus === "success",
  };
}
