"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useIdentity } from "@/hooks/identityHook";
import {
  consumeSignInRedirect,
  peekCommunityReferral,
  peekSignInRedirect,
  persistCommunityReferral,
  persistSignInRedirect,
  safeRedirectPath,
} from "@/lib/auth-redirect";
import { markGatePassed } from "@/lib/app-gate-pass";
import { requestGasTopup } from "@/lib/faucet/request-client";
import { hasChosenUsername } from "@/lib/profile/invented-username";

export type PostAuthRouteState =
  | "loading"
  | "idle"
  | "redirecting_home"
  | "redirecting_welcome"
  | "needs_ubi_claim";

/** Set until a new player joins a starter card. Brings them back to /play on the next sign-in. */
const NEEDS_STARTER_KEY = "delulu:needs-starter";

function needsStarter(address: string): boolean {
  try {
    return localStorage.getItem(NEEDS_STARTER_KEY) === address.toLowerCase();
  } catch {
    return false;
  }
}

export function usePostAuthRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, isReady, address } = useAuth();

  const [routeState, setRouteState] = useState<PostAuthRouteState>("idle");
  const hasRedirectedRef = useRef(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const lastAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const community = searchParams.get("community");
    if (community) persistCommunityReferral(community);
    persistSignInRedirect(searchParams.get("redirect"));
  }, [searchParams]);

  const { data: username, isFetching: isFetchingUsername } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: !!authenticated && !!address, staleTime: 0, gcTime: 0 },
  });

  const hasOnChainUsername = !!address && hasChosenUsername(address, typeof username === "string" ? username : "");
  const hasProfile = hasOnChainUsername;

  // Routing and the main-app gate MUST agree: setProfile is the only profile.
  const {
    identityState,
    isLoading: isIdentityLoading,
    refresh: refreshIdentity,
  } = useIdentity();
  // Still consulted after the in-page verify flow, which updates this first.
  const { isWhitelisted: isClaimWhitelisted, refreshStatus: refreshClaimStatus } =
    useGoodDollarClaim();

  const isWhitelisted = identityState.state === "verified" || isClaimWhitelisted;


  const refreshGoodDollarStatus = async () => {
    await Promise.all([refreshClaimStatus(), refreshIdentity()]);
  };

  const redirectTarget = useMemo(
    () => peekSignInRedirect() ?? safeRedirectPath(searchParams.get("redirect")) ?? "/home",
    [searchParams],
  );

  useEffect(() => {
    const normalizedAddress = address?.toLowerCase() ?? null;
    if (normalizedAddress !== lastAddressRef.current) {
      lastAddressRef.current = normalizedAddress;
      hasRedirectedRef.current = false;
    }

    if (!isReady || !authenticated || !address) {
      setRouteState("idle");
      hasRedirectedRef.current = false;
      return;
    }
    if (isFetchingUsername || (!hasProfile && isIdentityLoading && !isClaimWhitelisted)) {
      setRouteState("loading");
      return;
    }

    // In the app only after setProfile. A database row is not enough.
    if (hasProfile) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;

      const referral = peekCommunityReferral();
      let target = redirectTarget;
      if (referral && (target === "/home" || !target.startsWith("/join/"))) {
        target = `/join/${referral}`;
      }

      consumeSignInRedirect();
      markGatePassed(address);
      setRouteState("redirecting_home");
      void import("@/components/main-app-header");
      // Still on the starter cards: top the wallet up to 0.4 CELO. Face-verified
      // signups used to skip this, so a 0.3 GoodDollar drip was all they got.
      if (isWhitelisted && needsStarter(address)) void requestGasTopup();
      router.replace(needsStarter(address) ? "/play" : target);
      return;
    }

    // No contract profile yet. The face check comes first: GoodDollar sends
    // a little CELO on verification, which pays for setProfile, and the
    // faucet only tops up verified wallets. Without it /welcome is a dead end.
    if (!isWhitelisted) {
      hasRedirectedRef.current = false;
      setRouteState("needs_ubi_claim");
      return;
    }

    // Verified: /welcome is the only next step, where they choose a username
    // and photo and setProfile writes it on chain. Nothing else opens first.
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    setRouteState("redirecting_welcome");
    try {
      localStorage.setItem(NEEDS_STARTER_KEY, address.toLowerCase());
    } catch {
      /* private mode: this visit still opens the cards after they save */
    }
    void requestGasTopup();
    router.replace("/welcome");
  }, [
    isReady,
    authenticated,
    address,
    isFetchingUsername,
    isIdentityLoading,
    isClaimWhitelisted,
    isWhitelisted,
    hasProfile,
    router,
    redirectTarget,
  ]);

  const retrySetup = useCallback(() => {
    hasRedirectedRef.current = false;
    setSetupError(null);
  }, []);

  return {
    routeState,
    hasProfile,
    isWhitelisted,
    refreshGoodDollarStatus,
    setupError,
    retrySetup,
    address: address ?? "",
    isCheckingAccount: isFetchingUsername || (!hasProfile && isIdentityLoading && !isClaimWhitelisted),
  };
}
