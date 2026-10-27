"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { formatUnits, parseAbi } from "viem";
import { usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  checkGoodDollarWhitelisted,
  useClaimSDK,
} from "@/hooks/use-claim-sdk";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { IDENTITY_ADDRESS } from "@/lib/identity/status";
import { recordAppEarned } from "@/lib/record-app-earned";

/** GoodDollar UBIScheme on Celo (production) — same address the citizen SDK uses. */
const UBI_SCHEME_ADDRESS = "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const READ_ABI = parseAbi([
  "function getWhitelistedRoot(address account) view returns (address)",
  "function checkEntitlement(address _member) view returns (uint256)",
  "function periodStart() view returns (uint256)",
  "function currentDay() view returns (uint256)",
]);
const DAY_MS = 86_400_000;

export interface RefreshStatusResult {
  isWhitelisted: boolean;
  entitlement: bigint | null;
  hasClaimed: boolean;
}

export interface UseGoodDollarClaimReturn {
  isLoading: boolean;
  isClaiming: boolean;
  isVerifying: boolean;
  isWhitelisted: boolean;
  entitlement: bigint | null;
  hasClaimed: boolean;
  nextClaimTime: Date | null;
  claim: () => Promise<void>;
  refreshStatus: () => Promise<RefreshStatusResult>;
  startVerifying: () => void;
  stopVerifying: () => void;
  error: Error | null;
  isInitialized: boolean;
  /** True once the wallet-backed SDK is ready, so claim() can actually run. */
  sdkReady: boolean;
}

export function useGoodDollarClaim(): UseGoodDollarClaimReturn {
  const { address } = useAuth();
  const { claimSDK: claimSDKInstance, isReady } = useClaimSDK();
  const queryClient = useQueryClient();

  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [entitlement, setEntitlement] = useState<bigint | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);
  /** Bumped when the next claim opens, to re-run the pre-SDK read below. */
  const [claimWindowTick, setClaimWindowTick] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  const isLoading = !isReady;
  const celoClient = usePublicClient({ chainId: CELO_MAINNET_ID });

  // Read-only status straight from the chain while the wallet-backed SDK is
  // still connecting (or never connects this session), so the daily money
  // card shows the real state instead of a loading placeholder.
  useEffect(() => {
    if (!isLoading || !address || !celoClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const member = address as `0x${string}`;
        const root = await celoClient.readContract({
          address: IDENTITY_ADDRESS,
          abi: READ_ABI,
          functionName: "getWhitelistedRoot",
          args: [member],
        });
        const whitelisted = root !== ZERO_ADDRESS;
        let amount = 0n;
        let next: Date | null = null;
        if (whitelisted) {
          amount = await celoClient.readContract({
            address: UBI_SCHEME_ADDRESS,
            abi: READ_ABI,
            functionName: "checkEntitlement",
            args: [member],
          });
          if (amount === 0n) {
            const [start, day] = await Promise.all([
              celoClient.readContract({ address: UBI_SCHEME_ADDRESS, abi: READ_ABI, functionName: "periodStart" }),
              celoClient.readContract({ address: UBI_SCHEME_ADDRESS, abi: READ_ABI, functionName: "currentDay" }),
            ]);
            const ref = new Date(Number(start) * 1000 + Number(day) * DAY_MS);
            next = ref < new Date() ? new Date(ref.getTime() + DAY_MS) : ref;
          }
        }
        if (cancelled) return;
        setIsWhitelisted(whitelisted);
        setEntitlement(amount);
        setHasClaimed(whitelisted && amount === 0n);
        setNextClaimTime(next);
        setIsInitialized(true);
      } catch {
        // Leave it to the SDK path once the wallet connects.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, address, celoClient, claimWindowTick]);

  const checkWhitelisted = useCallback(async (): Promise<boolean> => {
    return checkGoodDollarWhitelisted(claimSDKInstance);
  }, [claimSDKInstance]);

  const checkClaimStatus = useCallback(async (): Promise<{
    entitlement: bigint | null;
    hasClaimed: boolean;
  } | null> => {
    if (!claimSDKInstance) return null;
    try {
      const walletStatus = await claimSDKInstance.getWalletClaimStatus();
      let nextTime: Date;
      try {
        nextTime = await claimSDKInstance.nextClaimTime();
      } catch (nextTimeErr: unknown) {
        const errorMessage =
          nextTimeErr instanceof Error
            ? nextTimeErr.message
            : String(nextTimeErr);
        if (
          errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
          errorMessage.includes("fuse-rpc") ||
          errorMessage.includes("pokt.network") ||
          errorMessage.includes("network")
        ) {
          nextTime = new Date(0);
        } else {
          throw nextTimeErr;
        }
      }

      const claimed = walletStatus.status === "already_claimed";
      setEntitlement(walletStatus.entitlement);
      setHasClaimed(claimed);
      setNextClaimTime(nextTime.getTime() === 0 ? null : nextTime);
      return { entitlement: walletStatus.entitlement, hasClaimed: claimed };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
        errorMessage.includes("fuse-rpc") ||
        errorMessage.includes("pokt.network") ||
        errorMessage.includes("network")
      ) {
        return null;
      }
      console.error("[useGoodDollarClaim] Failed to check claim status:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to check claim status"),
      );
      return null;
    }
  }, [claimSDKInstance]);

  useEffect(() => {
    if (isLoading || !address) {
      setIsInitialized(false);
      // Let the check re-run once the SDK is ready again — otherwise a brief
      // wallet-client reconnect leaves isInitialized false for good.
      fetchedForRef.current = null;
      return;
    }
    if (fetchedForRef.current === address) return;
    fetchedForRef.current = address;

    (async () => {
      try {
        const whitelisted = await checkWhitelisted();
        setIsWhitelisted(whitelisted);
        await checkClaimStatus();
        setIsInitialized(true);
      } catch {
        setIsInitialized(true);
      }
    })();
  }, [isLoading, address, checkWhitelisted, checkClaimStatus]);

  useEffect(() => {
    if (isLoading || !address) return;

    const interval = setInterval(() => {
      checkClaimStatus().catch(() => {});
      // Retry whitelist status too — a transient RPC/network failure during
      // the one-time initial check would otherwise mislabel an already
      // whitelisted wallet as unverified for the rest of the session.
      if (!isWhitelisted) {
        checkWhitelisted().then(setIsWhitelisted).catch(() => {});
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isLoading, address, checkClaimStatus, checkWhitelisted, isWhitelisted]);

  // Re-check the moment the next claim opens — otherwise the card sits on an
  // expired countdown until the 60s poll (or forever, before the SDK loads).
  useEffect(() => {
    if (!hasClaimed || !nextClaimTime) return;
    const delay = Math.max(0, nextClaimTime.getTime() - Date.now()) + 2_000;
    // setTimeout overflows past ~24.8 days; a claim window is never that far out.
    if (delay > 2_147_000_000) return;
    const id = setTimeout(() => {
      if (claimSDKInstance) checkClaimStatus().catch(() => {});
      else setClaimWindowTick((t) => t + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [hasClaimed, nextClaimTime, claimSDKInstance, checkClaimStatus]);

  useEffect(() => {
    if (!isVerifying) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (!claimSDKInstance) return;

    pollRef.current = setInterval(async () => {
      const whitelisted = await checkWhitelisted();
      if (whitelisted) {
        setIsWhitelisted(true);
        setIsVerifying(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        await checkClaimStatus();
      }
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isVerifying, claimSDKInstance, checkWhitelisted, checkClaimStatus]);

  const refreshStatus = useCallback(async (): Promise<RefreshStatusResult> => {
    if (!claimSDKInstance) {
      return {
        isWhitelisted: false,
        entitlement: null,
        hasClaimed: false,
      };
    }

    const whitelisted = await checkWhitelisted();
    setIsWhitelisted(whitelisted);
    const claimSnapshot = await checkClaimStatus();
    setIsInitialized(true);

    return {
      isWhitelisted: whitelisted,
      entitlement: claimSnapshot?.entitlement ?? null,
      hasClaimed: claimSnapshot?.hasClaimed ?? false,
    };
  }, [claimSDKInstance, checkWhitelisted, checkClaimStatus]);

  const startVerifying = useCallback(() => {
    setIsVerifying(true);
  }, []);

  const stopVerifying = useCallback(() => {
    setIsVerifying(false);
  }, []);

  const claim = async () => {
    if (!claimSDKInstance) return;

    try {
      setIsClaiming(true);
      // Capture entitlement before claim — SDK clears it after a successful claim.
      const amountGd =
        entitlement != null && entitlement > BigInt(0)
          ? Number(formatUnits(entitlement, 18))
          : 0;

      await claimSDKInstance.claim();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // The claim SDK auto-tops up CELO gas for low-balance wallets as part of
      // claim() itself — refetch everything (incl. the gas-balance check
      // behind the "no gas" prompt) so that top-up is reflected immediately
      // instead of waiting on the gas hook's own poll interval.
      void queryClient.invalidateQueries();

      recordAppEarned({
        address,
        amount: Number.isFinite(amountGd) ? amountGd : 0,
        tokenAddress: GOODDOLLAR_ADDRESSES.mainnet,
        kind: "ubi",
      });

      await checkClaimStatus();

      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default || confettiModule;
        if (confetti && typeof confetti === "function") {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#f6c324", "#2db36f", "#ec4899", "#161615"],
          });
        }
      } catch {
        // optional
      }
    } catch (error: unknown) {
      console.error("Claim failed:", error);
      setError(error instanceof Error ? error : new Error("Claim failed"));
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    isLoading,
    isClaiming,
    isVerifying,
    isWhitelisted,
    entitlement,
    hasClaimed,
    nextClaimTime,
    claim,
    refreshStatus,
    startVerifying,
    stopVerifying,
    error,
    isInitialized,
    sdkReady: isReady,
  };
}
