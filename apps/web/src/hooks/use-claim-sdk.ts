"use client";

import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { useIdentitySDK, IdentitySDK } from "@goodsdks/identity-sdk";
import { ClaimSDK } from "@goodsdks/citizen-sdk";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";

/** Memoized GoodDollar ClaimSDK for the connected wallet (shared by claim + whitelist checks). */
export function useClaimSDK() {
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

  const isReady = useMemo(
    () =>
      !!address &&
      !!publicClient &&
      !!walletClient &&
      hasWalletAccount &&
      !!identitySDK &&
      !!ClaimSDK,
    [address, publicClient, walletClient, hasWalletAccount, identitySDK],
  );

  const claimSDK = useMemo(() => {
    if (!isReady || !address || !publicClient || !walletClient || !identitySDK) {
      return null;
    }
    return new ClaimSDK({
      account: address,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      identitySDK: identitySDK as any,
      env: "production",
    });
  }, [isReady, address, publicClient, walletClient, identitySDK]);

  return { claimSDK, isReady };
}

export async function checkGoodDollarWhitelisted(
  claimSDK: ClaimSDK | null,
): Promise<boolean> {
  if (!claimSDK) return false;
  try {
    const walletStatus = await claimSDK.getWalletClaimStatus();
    return walletStatus.status !== "not_whitelisted";
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "");
    if (
      errorMessage.includes("ERR_NAME_NOT_RESOLVED") ||
      errorMessage.includes("fuse-rpc") ||
      errorMessage.includes("pokt.network") ||
      errorMessage.includes("network")
    ) {
      return false;
    }
    console.error("[checkGoodDollarWhitelisted] failed:", err);
    return false;
  }
}
