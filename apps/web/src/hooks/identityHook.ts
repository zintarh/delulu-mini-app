"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { useIdentitySDK, IdentitySDK } from "@goodsdks/identity-sdk";
import { ClaimSDK } from "@goodsdks/citizen-sdk";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";

export type IdentityStatus = "loading" | "verified" | "not_verified" | "error";

export function useIdentity() {
  const { address } = useAuth();
  const publicClient = usePublicClient();
  const walletClient = useUnifiedWalletClient();
  const identitySDKFromHook = useIdentitySDK("production");
  const identitySDK = useMemo(() => {
    if (identitySDKFromHook) return identitySDKFromHook;
    if (!publicClient || !walletClient) return null;
    return new (IdentitySDK as any)(publicClient, walletClient, "production");
  }, [identitySDKFromHook, publicClient, walletClient]);

  const [status, setStatus] = useState<IdentityStatus>("loading");
  const [fvLink, setFvLink] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const checkVerification = async () => {
    if (!address || !publicClient || !identitySDK || !walletClient?.account?.address) {
      setStatus("not_verified");
      return;
    }


    try {
      // Don't set loading if we're polling in the background
      if (!isVerifying) setStatus("loading");

      const claimSDK = new ClaimSDK({
        account: address,
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        identitySDK: identitySDK as any,
        env: "production",
      });

      await claimSDK.checkEntitlement();
      const walletStatus = await claimSDK.getWalletClaimStatus();


      if (walletStatus.status === "not_whitelisted") {
        setStatus("not_verified");
      } else {
        setStatus("verified");
        setIsVerifying(false); // Stop verifying if we're now verified
      }
    } catch (error) {
      console.error("Identity check failed:", error);
      setStatus("error");
    }
  };

  /**
   * Always requests a brand-new FV link from GoodDollar — never reuses
   * `fvLink`. Callers that want to retry after a failed/expired attempt
   * (FVFlowError on GoodDollar's side, or just a stale link sitting around
   * too long) must call this again rather than reopening the old string, or
   * they'll just resend whatever already failed. Returns the new link (or
   * null on failure) so a caller can navigate a tab it already opened.
   */
  const generateLink = async (): Promise<string | null> => {
    if (
      !address ||
      !publicClient ||
      !identitySDK ||
      !walletClient ||
      isGeneratingLink
    )
      return null;

    // walletClient resolves independently across our three auth providers
    // (wagmi/Web3Auth/Privy) and can briefly lag behind `address` (e.g. right
    // after switching accounts). Signing an FV link for whatever account
    // walletClient currently holds — instead of the one the rest of the app
    // (and checkVerification, via `account: address` above) is tracking —
    // would whitelist a wallet we're not even checking status for, so the
    // user could "verify" and still show as not_verified forever. Wait for
    // them to line up instead of generating against a mismatch.
    const walletAddress = walletClient.account?.address;
    if (!walletAddress || walletAddress.toLowerCase() !== address.toLowerCase()) {
      return null;
    }

    try {
      setIsGeneratingLink(true);

      const idSDK = new (IdentitySDK as any)(
        publicClient,
        walletClient,
        "production",
      );

      // Signature: generateFVLink(popupMode?: boolean, callbackUrl?: string, chainId?: number)
      const linkResult = await idSDK.generateFVLink(
        false,
        window.location.href,
        42220,
      );


      let finalLink = "";
      if (typeof linkResult === "string") {
        finalLink = linkResult;
      } else if (linkResult && (linkResult as any).link) {
        finalLink = (linkResult as any).link;
      }

      if (finalLink) {
        setFvLink(finalLink);
        setStatus("not_verified");
        return finalLink;
      }
      setStatus("error");
      return null;
    } catch (e: any) {
      console.error("❌ Failed to generate FV link:", e);
      setStatus("error");
      return null;
    } finally {
      setIsGeneratingLink(false);
    }
  };

  useEffect(() => {
    checkVerification();
  }, [address, !!publicClient, !!identitySDK, !!walletClient?.account?.address]);

  // Referral credit check: fire once per address when verification lands, in
  // case a referral is only waiting on this to be counted (the forfeit/campaign
  // side is checked independently at forfeit-creation / campaign-join time).
  const referralCheckFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "verified" || !address) return;
    if (referralCheckFiredForRef.current === address) return;
    referralCheckFiredForRef.current = address;
    fetch("/api/referral/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ walletAddress: address }),
    }).catch(() => {});
  }, [status, address]);

  // Generate link only once when verification process starts
  useEffect(() => {
    if (isVerifying && !fvLink && !isGeneratingLink) {
      generateLink();
    }
  }, [
    isVerifying,
    !!fvLink,
    isGeneratingLink,
    address,
    publicClient,
    walletClient,
    identitySDK,
  ]);

  // Handle background polling during verification flow (status only!)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isVerifying && status !== "verified") {
      interval = setInterval(() => {
        checkVerification();
      }, 5000); // Poll every 5 seconds while verifying
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVerifying, status, address, publicClient, identitySDK]);

  return {
    status,
    isVerified: status === "verified",
    fvLink,
    refresh: checkVerification,
    generateLink,
    isLoading: status === "loading",
    isVerifying,
    setIsVerifying,
    isGeneratingLink,
  };
}


