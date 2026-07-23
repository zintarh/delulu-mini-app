"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  useClaimReward,
  usePendingReward,
} from "@/hooks/use-reward-vault";
import {
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
} from "@/lib/constant";

/** Aggregates pending admin RewardVault balances and claims them all. */
export function useClaimAllAdminRewards(address: `0x${string}` | undefined) {
  const gd = usePendingReward(address, GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`);
  const cusd = usePendingReward(address, CUSD_ADDRESSES.mainnet as `0x${string}`);
  const usdt = usePendingReward(address, USDT_ADDRESSES.mainnet as `0x${string}`);
  const { claimReward, isPending: isClaimPending } = useClaimReward();
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard — isClaimingAll is React state and won't disable the
  // button until the next render, so a fast double-click could otherwise
  // start a second overlapping claimAll() before the first sets it.
  const isRunningRef = useRef(false);

  const pendingByToken = useMemo(
    () =>
      [
        { token: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`, pending: gd.pending, refetch: gd.refetch },
        { token: CUSD_ADDRESSES.mainnet as `0x${string}`, pending: cusd.pending, refetch: cusd.refetch },
        { token: USDT_ADDRESSES.mainnet as `0x${string}`, pending: usdt.pending, refetch: usdt.refetch },
      ] as const,
    [gd.pending, gd.refetch, cusd.pending, cusd.refetch, usdt.pending, usdt.refetch],
  );

  const hasPending = pendingByToken.some((t) => t.pending > 0n);
  const isLoading = gd.isLoading || cusd.isLoading || usdt.isLoading;

  const claimAll = useCallback(async () => {
    if (!address || !hasPending || isRunningRef.current) return;
    isRunningRef.current = true;
    setError(null);
    setIsClaimingAll(true);
    // Claim each token independently — one token reverting (wallet rejection,
    // RPC blip) shouldn't stop the others from going through.
    const failures: string[] = [];
    try {
      for (const row of pendingByToken) {
        if (row.pending <= 0n) continue;
        try {
          await claimReward(row.token);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "Claim failed");
        } finally {
          await row.refetch();
        }
      }
      if (failures.length > 0) {
        const message = failures.join("; ");
        setError(message);
        throw new Error(message);
      }
    } finally {
      setIsClaimingAll(false);
      isRunningRef.current = false;
    }
  }, [address, hasPending, pendingByToken, claimReward]);

  return {
    hasPending,
    isLoading,
    isClaiming: isClaimingAll || isClaimPending,
    error,
    claimAll,
    pendingByToken,
    refetchAll: () => {
      void gd.refetch();
      void cusd.refetch();
      void usdt.refetch();
    },
  };
}
