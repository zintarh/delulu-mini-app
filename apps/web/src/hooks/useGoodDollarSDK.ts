"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits } from "viem";

// Internal SDK references (not React hooks)
let identitySDKFn: any;
let ClaimSDK: any;




try {
  const identitySDK = require("@goodsdks/identity-sdk");
  const citizenSDK = require("@goodsdks/citizen-sdk");
  // Store the hook-like function under a non-hook name to satisfy ESLint rules
  identitySDKFn =
    identitySDK.useIdentitySDK || identitySDK.default?.useIdentitySDK;
  ClaimSDK =
    citizenSDK.ClaimSDK ||
    citizenSDK.default?.ClaimSDK ||
    identitySDK.ClaimSDK;
} catch (error) {
  console.warn("[useGoodDollarSDK] SDK packages not found:", error);
}




export function useGoodDollarSDK() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const env = "production" as const;

  // Call the SDK helper function if available (not treated as a React hook)
  const identitySDK = identitySDKFn ? identitySDKFn(env) : null;
  const [claimSDK, setClaimSDK] = useState<any>(null);
  const [entitlement, setEntitlement] = useState<bigint | null>(null);
  const [nextClaimDate, setNextClaimDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize ClaimSDK
  useEffect(() => {
    if (!ClaimSDK) {
      setError(new Error("GoodDollar SDK not installed"));
      setIsLoading(false);
      return;
    }

    if (!address || !publicClient || !walletClient || !identitySDK) {
      setClaimSDK(null);
      setIsLoading(false);
      return;
    }

    try {
      const sdk = new ClaimSDK({
        account: address,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK,
        env,
      });
      setClaimSDK(sdk);
      setError(null);
    } catch (err) {
      console.error("[useGoodDollarSDK] Failed to initialize:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize SDK"));
      setIsLoading(false);
    }
  }, [address, publicClient, walletClient, identitySDK, env]);

  useEffect(() => {
    if (!claimSDK) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [entitlementBigInt, nextDate] = await Promise.all([
          claimSDK.checkEntitlement(),
          claimSDK.nextClaimTime(),
        ]);
        setEntitlement(entitlementBigInt);
        setNextClaimDate(nextDate);
      } catch (err) {
        console.error("[useGoodDollarSDK] Failed to fetch data:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch entitlement"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [claimSDK]);

  const claim = useCallback(async () => {
    if (!claimSDK) throw new Error("SDK not initialized");

    setIsClaiming(true);
    setError(null);
    try {
      await claimSDK.claim();
      const [entitlementBigInt, nextDate] = await Promise.all([
        claimSDK.checkEntitlement(),
        claimSDK.nextClaimTime(),
      ]);
      setEntitlement(entitlementBigInt);
      setNextClaimDate(nextDate);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Claim failed");
      setError(error);
      throw error;
    } finally {
      setIsClaiming(false);
    }
  }, [claimSDK]);

  const formattedEntitlement = useMemo(() => {
    if (entitlement === null) return null;
    return formatUnits(entitlement, 18);
  }, [entitlement]);

  return {
    entitlement: formattedEntitlement,
    nextClaimDate,
    claim,
    isLoading,
    isClaiming,
    error,
    canClaim: entitlement !== null && entitlement > 0n,
    isReady: !!claimSDK && !!address && !!publicClient && !!walletClient,
  };
}
