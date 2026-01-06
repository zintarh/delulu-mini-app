import { useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/fetchers";
import { 
  withRetry, 
  savePendingSync, 
  removePendingSync, 
  getPendingSyncs,
  cleanupOldPendingSyncs,
} from "@/lib/retry";

/**
 * Hook to sync blockchain transactions with backend
 * Uses exponential backoff retry and localStorage fallback
 */
export function useBackendSync() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // Retry pending syncs on mount
  useEffect(() => {
    if (!address) return;
    
    cleanupOldPendingSyncs();
    retryPendingSyncs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Retry any pending syncs from localStorage
  const retryPendingSyncs = useCallback(async () => {
    const pending = getPendingSyncs();
    if (pending.length === 0) return;

    console.log(`[BackendSync] Retrying ${pending.length} pending syncs...`);

    for (const sync of pending) {
      try {
        if (sync.type === 'delulu') {
          await api.createDelulu(sync.data as Parameters<typeof api.createDelulu>[0]);
        } else if (sync.type === 'stake') {
          await api.createStake(sync.data as Parameters<typeof api.createStake>[0]);
        } else if (sync.type === 'claim') {
          await api.createClaim(sync.data as Parameters<typeof api.createClaim>[0]);
        }
        
        removePendingSync(sync.txHash);
        console.log(`[BackendSync] Successfully synced pending ${sync.type}: ${sync.txHash}`);
      } catch (error) {
        console.warn(`[BackendSync] Failed to sync pending ${sync.type}: ${sync.txHash}`, error);
      }
    }

    // Invalidate queries after retrying
    queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
    if (address) {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(address) });
    }
  }, [address, queryClient]);

  const syncUser = useCallback(
    async (data?: { fid?: number; username?: string; pfpUrl?: string }) => {
      if (!address) return null;
      
      try {
        const result = await withRetry(
          () => api.createUser({ address, ...data }),
          {
            maxAttempts: 3,
            initialDelayMs: 500,
            onRetry: (attempt, error) => {
              console.warn(`[SyncUser] Retry ${attempt}: ${error.message}`);
            },
          }
        );
        
        queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(address) });
        return result;
      } catch (error) {
        console.error("[SyncUser] Failed after retries:", error);
        return null;
      }
    },
    [address, queryClient]
  );

  const syncDelulu = useCallback(
    async (data: {
      onChainId: string;
      contentHash: string;
      content?: string;
      stakingDeadline: Date;
      resolutionDeadline: Date;
      bgImageUrl?: string;
      gatekeeper?: {
        enabled: boolean;
        type?: string;
        value?: string;
        label?: string;
      };
    }) => {
      if (!address) return null;

      const payload = {
        onChainId: data.onChainId,
        contentHash: data.contentHash,
        content: data.content,
        creatorAddress: address,
        stakingDeadline: data.stakingDeadline.toISOString(),
        resolutionDeadline: data.resolutionDeadline.toISOString(),
        bgImageUrl: data.bgImageUrl,
        gatekeeper: data.gatekeeper,
      };

      try {
        const result = await withRetry(
          () => api.createDelulu(payload),
          {
            maxAttempts: 5,
            initialDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[SyncDelulu] Retry ${attempt}: ${error.message}`);
            },
          }
        );

        // Success - invalidate queries
        queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(address) });
        
        return result;
      } catch (error) {
        console.error("[SyncDelulu] Failed after retries, saving to pending:", error);
        
        // Save to localStorage for retry on next page load
        savePendingSync({
          id: data.onChainId,
          type: 'delulu',
          data: payload,
          txHash: data.contentHash, // Use contentHash as unique identifier
        });
        
        return null;
      }
    },
    [address, queryClient]
  );

  const syncStake = useCallback(
    async (data: {
      deluluId: string;
      amount: number;
      side: boolean;
      txHash: string;
    }) => {
      if (!address) return null;

      const payload = {
        userAddress: address,
        deluluId: data.deluluId,
        amount: data.amount,
        side: data.side,
        txHash: data.txHash,
      };

      try {
        const result = await withRetry(
          () => api.createStake(payload),
          {
            maxAttempts: 5,
            initialDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[SyncStake] Retry ${attempt}: ${error.message}`);
            },
          }
        );

        // Success - invalidate queries
        queryClient.invalidateQueries({ queryKey: queryKeys.delulus.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stakedDelulus(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stakes(address) });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        
        return result;
      } catch (error) {
        console.error("[SyncStake] Failed after retries, saving to pending:", error);
        
        // Save to localStorage for retry on next page load
        savePendingSync({
          id: `${data.deluluId}-${data.txHash}`,
          type: 'stake',
          data: payload,
          txHash: data.txHash,
        });
        
        return null;
      }
    },
    [address, queryClient]
  );

  const syncClaim = useCallback(
    async (data: { deluluId: string; amount: number; txHash: string }) => {
      if (!address) return null;

      const payload = {
        userAddress: address,
        deluluId: data.deluluId,
        amount: data.amount,
        txHash: data.txHash,
      };

      try {
        const result = await withRetry(
          () => api.createClaim(payload),
          {
            maxAttempts: 5,
            initialDelayMs: 1000,
            onRetry: (attempt, error) => {
              console.warn(`[SyncClaim] Retry ${attempt}: ${error.message}`);
            },
          }
        );

        // Success - invalidate queries
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.claims(address) });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        
        return result;
      } catch (error) {
        console.error("[SyncClaim] Failed after retries, saving to pending:", error);
        
        // Save to localStorage for retry on next page load
        savePendingSync({
          id: `${data.deluluId}-${data.txHash}`,
          type: 'claim',
          data: payload,
          txHash: data.txHash,
        });
        
        return null;
      }
    },
    [address, queryClient]
  );

  return { syncUser, syncDelulu, syncStake, syncClaim, retryPendingSyncs };
}
