"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  checkGoodDollarWhitelisted,
  useClaimSDK,
} from "@/hooks/use-claim-sdk";

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
}

export function useGoodDollarClaim(): UseGoodDollarClaimReturn {
  const { address } = useAuth();
  const { claimSDK: claimSDKInstance, isReady } = useClaimSDK();

  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [entitlement, setEntitlement] = useState<bigint | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  const isLoading = !isReady;

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
    }, 60000);

    return () => clearInterval(interval);
  }, [isLoading, address, checkClaimStatus]);

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
      await claimSDKInstance.claim();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      fetch("/api/profile/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      }).catch(() => {});

      await checkClaimStatus();

      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default || confettiModule;
        if (confetti && typeof confetti === "function") {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#6366f1", "#a855f7", "#ec4899", "#f59e0b"],
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
  };
}
