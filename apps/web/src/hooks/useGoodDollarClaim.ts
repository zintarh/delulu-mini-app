"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { usePublicClient } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";
import { IdentitySDK, useIdentitySDK } from "@goodsdks/identity-sdk";
import { ClaimSDK } from "@goodsdks/citizen-sdk";

export interface UseGoodDollarClaimReturn {
  isLoading: boolean;
  isClaiming: boolean;
  isVerifying: boolean;
  isWhitelisted: boolean;
  entitlement: bigint | null;
  hasClaimed: boolean;
  nextClaimTime: Date | null;
  claim: () => Promise<void>;
  error: Error | null;
  isInitialized: boolean;
}

export function useGoodDollarClaim(): UseGoodDollarClaimReturn {
  const { address } = useAuth();
  const publicClient = usePublicClient();
  const walletClient = useUnifiedWalletClient();
  const identitySDKFromHook = useIdentitySDK("production");
  const walletClientAddress = walletClient?.account?.address;
  const hasWalletAccount = !!walletClientAddress;
  const identitySDK = useMemo(() => {
    if (identitySDKFromHook) return identitySDKFromHook;
    if (!publicClient || !walletClient || !hasWalletAccount) return null;
    return new (IdentitySDK as any)(publicClient, walletClient, "production");
  }, [identitySDKFromHook, publicClient, walletClient, hasWalletAccount]);

  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [entitlement, setEntitlement] = useState<bigint | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const isLoading =
    !address ||
    !publicClient ||
    !walletClient ||
    !hasWalletAccount ||
    !identitySDK ||
    !ClaimSDK;

  const checkWhitelisted = useCallback(async (): Promise<boolean> => {
    if (
      !ClaimSDK ||
      !address ||
      !publicClient ||
      !walletClient ||
      !hasWalletAccount ||
      !identitySDK
    ) {
      return false;
    }
    try {
      const claimSDK = new ClaimSDK({
        account: address,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK: identitySDK as any,
        env: "production",
      });
      const walletStatus = await claimSDK.getWalletClaimStatus();
      return walletStatus.status !== "not_whitelisted";
    } catch (err: any) {
      // Suppress network errors from alternative chain checks
      const errorMessage = err?.message || String(err);
      if (
        errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
        errorMessage.includes("fuse-rpc") ||
        errorMessage.includes("pokt.network") ||
        errorMessage.includes("network")
      ) {
        // Silently ignore alternative chain RPC errors, return false (not whitelisted)
        return false;
      }
      console.error("[useGoodDollarClaim] isWhitelisted check failed:", err);
      return false;
    }
  }, [address, publicClient, walletClient, hasWalletAccount, identitySDK]);

  const checkClaimStatus = useCallback(async () => {
    if (
      !ClaimSDK ||
      !address ||
      !publicClient ||
      !walletClient ||
      !hasWalletAccount ||
      !identitySDK
    ) {
      return;
    }
    try {
      const claimSDK = new ClaimSDK({
        account: address,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK: identitySDK as any,
        env: "production",
      });

      // Use getWalletClaimStatus to get status, entitlement, and nextClaimTime
      const walletStatus = await claimSDK.getWalletClaimStatus();
      // Get nextClaimTime separately (returns epoch 0 if can claim now)
      // Wrap in try-catch to handle alternative chain RPC errors
      let nextTime: Date;
      try {
        nextTime = await claimSDK.nextClaimTime();
      } catch (nextTimeErr: any) {
        // Suppress network errors from alternative chain checks (e.g., Fuse RPC)
        const errorMessage = nextTimeErr?.message || String(nextTimeErr);
        if (
          errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
          errorMessage.includes("fuse-rpc") ||
          errorMessage.includes("pokt.network") ||
          errorMessage.includes("network")
        ) {
          // Silently ignore alternative chain RPC errors, use epoch 0 as fallback
          nextTime = new Date(0);
        } else {
          throw nextTimeErr;
        }
      }


      setEntitlement(walletStatus.entitlement);
      setHasClaimed(walletStatus.status === "already_claimed");

     
      if (nextTime.getTime() === 0) {
        setNextClaimTime(null);
      } else {
        setNextClaimTime(nextTime);
      }
    } catch (err: any) {
      // Suppress network errors from alternative chain checks
      const errorMessage = err?.message || String(err);
      if (
        errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
        errorMessage.includes("fuse-rpc") ||
        errorMessage.includes("pokt.network") ||
        errorMessage.includes("network")
      ) {
        // Silently ignore alternative chain RPC errors
        return;
      }
      console.error("[useGoodDollarClaim] Failed to check claim status:", err);
      setError(err instanceof Error ? err : new Error("Failed to check claim status"));
    }
  }, [address, publicClient, walletClient, hasWalletAccount, identitySDK]);






  // Initialize SDK and check status on mount (silently, no loading state shown to user)
  useEffect(() => {
    if (isLoading) {
      setIsInitialized(false);
      return;
    }

    (async () => {
      try {
        const whitelisted = await checkWhitelisted();
        setIsWhitelisted(whitelisted);
        await checkClaimStatus();
        setIsInitialized(true);
      } catch (err) {
        // Silently handle errors during initialization
        setIsInitialized(true); // Still mark as initialized to avoid blocking UI
      }
    })();
  }, [isLoading, checkWhitelisted, checkClaimStatus]);

  // Poll claim status periodically to keep it updated
  useEffect(() => {
    if (isLoading || !address) return;

    // Only poll if we have a valid address and SDKs are loaded
    const interval = setInterval(() => {
      // Silently handle errors during polling
      checkClaimStatus().catch(() => {
        // Errors are already handled in checkClaimStatus
      });
    }, 60000); // Check every 60 seconds (reduced frequency to minimize errors)

    return () => clearInterval(interval);
  }, [isLoading, address, checkClaimStatus]);

  // Background polling while verifying
  useEffect(() => {
    if (!isVerifying) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (!identitySDK || !address) return;

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
  }, [isVerifying, identitySDK, address, checkWhitelisted, checkClaimStatus]);



  const claim = async () => {
    if (!address || !publicClient || !walletClient || !hasWalletAccount || !identitySDK) {
      return;
    }

    try {
      setIsClaiming(true);

      const claimSDK = new ClaimSDK({
        account: address,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK: identitySDK as any,
        env: "production",
      });

      await claimSDK.claim();

      // Wait a bit for the blockchain state to update
      console.log("[useGoodDollarClaim] Claim successful, waiting for state update...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Quietly persist claim count in profile DB; never block UX on this side effect.
      fetch("/api/profile/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      }).catch(() => {
        // intentionally swallowed
      });

      // Refresh claim status after claim
      await checkClaimStatus();

      // Launch Confetti Celebration!
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
        // Confetti is optional
      }
    } catch (error: any) {
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
    error,
    isInitialized, // Track when all checks are complete
  };
}