"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useChainId, useReadContract, usePublicClient } from "wagmi";
import { getForfeitMarketAddress, CELO_MAINNET_ID, CUSD_ADDRESSES, GOODDOLLAR_ADDRESSES, USDT_ADDRESSES } from "@/lib/constant";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { fireConfetti } from "@/lib/celebrate";

function forfeitMarketAddressOrUndefined(chainId: number): `0x${string}` | undefined {
  try {
    return getForfeitMarketAddress(chainId);
  } catch {
    return undefined;
  }
}

/**
 * A wallet's claimable balance from Friend-destination forfeitures — credited
 * by ForfeitMarket instead of transferred instantly, see claimFriendReward.
 * Pinned to Celo mainnet, same reasoning as usePendingReward.
 */
export function usePendingFriendReward(
  userAddress: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
) {
  const market = forfeitMarketAddressOrUndefined(CELO_MAINNET_ID);

  const { data, isLoading, error, refetch } = useReadContract({
    address: market,
    abi: FORFEIT_MARKET_ABI,
    functionName: "pendingFriendReward",
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!market && !!userAddress && !!tokenAddress },
  });

  return { pending: (data as bigint | undefined) ?? 0n, isLoading, error, refetch };
}

async function awaitMinedSuccess(
  publicClient: ReturnType<typeof usePublicClient>,
  hash: `0x${string}`,
  failureMessage: string,
) {
  if (!publicClient) throw new Error("No RPC client available to confirm the transaction");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    timeout: 120_000,
    pollingInterval: 1_500,
  });
  if (receipt.status !== "success") throw new Error(failureMessage);
  return receipt;
}

/** User-side claim of their full pending Friend-forfeiture reward for a token. */
export function useClaimFriendReward() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: hash, isPending, error, reset } = useUnifiedWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);
  const isRunningRef = useRef(false);

  const claimFriendReward = useCallback(
    async (tokenAddress: `0x${string}`) => {
      if (isRunningRef.current) throw new Error("A claim is already in progress");
      isRunningRef.current = true;
      setIsConfirming(true);
      try {
        const txHash = await writeContractAsync({
          address: getForfeitMarketAddress(chainId),
          abi: FORFEIT_MARKET_ABI,
          functionName: "claimFriendReward",
          args: [tokenAddress],
        });
        await awaitMinedSuccess(publicClient, txHash, "Claim transaction failed on-chain");
        return txHash;
      } finally {
        setIsConfirming(false);
        isRunningRef.current = false;
      }
    },
    [chainId, publicClient, writeContractAsync],
  );

  return {
    claimFriendReward,
    hash,
    isPending: isPending || isConfirming,
    error,
    reset,
  };
}

/** Aggregates pending Friend-forfeiture rewards across known tokens and claims them all. */
export function useClaimAllFriendRewards(address: `0x${string}` | undefined) {
  const gd = usePendingFriendReward(address, GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`);
  const cusd = usePendingFriendReward(address, CUSD_ADDRESSES.mainnet as `0x${string}`);
  const usdt = usePendingFriendReward(address, USDT_ADDRESSES.mainnet as `0x${string}`);
  const { claimFriendReward, isPending: isClaimPending } = useClaimFriendReward();
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
    if (!address || !hasPending || isRunningRef.current) {
      return { claimedCount: 0, failedCount: 0 };
    }
    isRunningRef.current = true;
    setError(null);
    setIsClaimingAll(true);
    // Claim each token independently — one token reverting (wallet rejection,
    // RPC blip) shouldn't stop the others from going through.
    const failures: string[] = [];
    let claimedCount = 0;
    try {
      for (const row of pendingByToken) {
        if (row.pending <= 0n) continue;
        try {
          await claimFriendReward(row.token);
          claimedCount += 1;
          // Celebrate as soon as the first claim mines so success feels instant.
          if (claimedCount === 1) void fireConfetti();
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "Claim failed");
        } finally {
          await row.refetch();
        }
      }
      if (failures.length > 0) {
        const message = failures.join("; ");
        setError(message);
        // Still return claimedCount so UI can celebrate partial success.
        return { claimedCount, failedCount: failures.length };
      }
      return { claimedCount, failedCount: 0 };
    } finally {
      setIsClaimingAll(false);
      isRunningRef.current = false;
    }
  }, [address, hasPending, pendingByToken, claimFriendReward]);

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
