"use client";

import { useEffect, useState, useMemo } from "react";
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
  const identitySDK = useIdentitySDK("production");

  const [status, setStatus] = useState<IdentityStatus>("loading");
  const [fvLink, setFvLink] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const checkVerification = async () => {
    if (!address || !publicClient || !identitySDK) {
      if (!address) setStatus("not_verified");
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

      const entitlement = await claimSDK.checkEntitlement();
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

  const generateLink = async () => {
    if (
      !address ||
      !publicClient ||
      !identitySDK ||
      !walletClient ||
      isGeneratingLink
    )
      return;

    try {
      setIsGeneratingLink(true);
      console.log("🔗 Generating FV link (Chain 42220) using identitySDK...");

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
      }
    } catch (e: any) {
      console.error("❌ Failed to generate FV link:", e);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  useEffect(() => {
    checkVerification();
  }, [address, !!publicClient, !!identitySDK]);

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
        console.log("🔍 Polling identity status...");
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


