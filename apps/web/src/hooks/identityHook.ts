"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { useIdentitySDK, IdentitySDK } from "@goodsdks/identity-sdk";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWalletClient } from "@/hooks/use-unified-wallet-client";
import { NONE, readIdentityStatus, type IdentityStatus as GoodDollarIdentityStatus } from "@/lib/identity/status";

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
  const [identityState, setIdentityState] = useState<GoodDollarIdentityStatus>(NONE);
  const [fvLink, setFvLink] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // How many times generateLink has bailed out because the wallet wasn't
  // live-ready yet, since this verification attempt started. Resets whenever
  // a fresh attempt begins (see the effect below) so a slow-but-real settle
  // doesn't get penalized by an earlier attempt's count.
  const walletNotReadyAttemptsRef = useRef(0);
  const MAX_WALLET_NOT_READY_ATTEMPTS = 8;

  useEffect(() => {
    if (isVerifying) walletNotReadyAttemptsRef.current = 0;
  }, [isVerifying]);

  // Reads GoodDollar's actual re-verification ladder (lib/identity/status.ts)
  // instead of a plain whitelisted/not-whitelisted boolean, so the UI can
  // tell "never verified" apart from "verified before, window lapsed" —
  // those need different copy and different urgency, not the same "you
  // aren't verified" message. Only needs `publicClient` — no wallet client
  // or signing involved, so unlike generateLink this can run the moment an
  // address is known, no settling wait required. GoodDollar's UBI claim
  // itself only works while state is "verified" (their own contract's
  // current-window requirement), so that's what "verified"/"not_verified"
  // below still track; identityState carries the richer picture.
  const checkVerification = async () => {
    if (!address || !publicClient) {
      setStatus("not_verified");
      setIdentityState(NONE);
      return;
    }

    try {
      // Don't set loading if we're polling in the background
      if (!isVerifying) setStatus("loading");

      const result = await readIdentityStatus(publicClient as any, address);
      setIdentityState(result);

      if (result.state === "verified") {
        setStatus("verified");
        setIsVerifying(false); // Stop verifying if we're now verified
      } else {
        setStatus("not_verified");
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

    try {
      setIsGeneratingLink(true);

      // walletClient resolves independently across our three auth providers
      // (wagmi/Web3Auth/Privy) and can briefly lag behind `address` (e.g.
      // right after switching accounts, or — most commonly — right after
      // Web3Auth's own login finishes but before we've finished registering
      // it as a wagmi connector, during which this hook falls back to a
      // hand-built client that can still be settling). GoodDollar's SDK
      // asks the wallet for its address and silently signs with it
      // internally (via getAddresses() + signMessage()) — if that live
      // answer disagrees with `address`, or the wallet isn't fully ready to
      // sign yet, GoodDollar's page gets a link it can't validate and shows
      // its own "login information is missing" error. So this checks the
      // SAME live getAddresses() call the SDK itself is about to make, not
      // just our cached `.account.address`, and gives it a few short
      // retries to settle before generating anything. Guarded by
      // isGeneratingLink (set above) so a dependency change mid-check can't
      // start a second, concurrent attempt.
      let liveAddress: string | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [addr] = await walletClient.getAddresses();
          liveAddress = addr;
        } catch {
          liveAddress = undefined;
        }
        if (liveAddress && liveAddress.toLowerCase() === address.toLowerCase()) break;
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      if (!liveAddress || liveAddress.toLowerCase() !== address.toLowerCase()) {
        walletNotReadyAttemptsRef.current += 1;
        if (walletNotReadyAttemptsRef.current >= MAX_WALLET_NOT_READY_ATTEMPTS) {
          // Genuinely stuck, not just settling — surface it instead of
          // spinning on "Preparing verification…" forever. A fresh "Verify"
          // attempt (isVerifying false→true) resets the budget above.
          setStatus("error");
        }
        return null;
      }
      walletNotReadyAttemptsRef.current = 0;

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
  }, [address, !!publicClient]);

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
  }, [isVerifying, status, address, publicClient]);

  return {
    status,
    isVerified: status === "verified",
    /** Full ladder detail (state/daysLeft/isProbation/...) — see lib/identity/status.ts. */
    identityState,
    /** Verified before, but the current window lapsed — needs a quick re-check, not a first-time verification. */
    isLapsed: identityState.state === "lapsed",
    fvLink,
    refresh: checkVerification,
    generateLink,
    isLoading: status === "loading",
    isVerifying,
    setIsVerifying,
    isGeneratingLink,
  };
}


