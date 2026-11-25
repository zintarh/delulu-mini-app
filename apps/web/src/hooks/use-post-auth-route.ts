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
import { isGeneratedUsername } from "@/lib/profile/generated-username";

export type PostAuthRouteState =
  | "loading"
  | "idle"
  | "redirecting_home"
  | "redirecting_welcome"
  | "needs_ubi_claim";

// Set once the gas faucet has funded this wallet in place of the face check —
// enough to sign the profile transaction on /welcome. Session-scoped so a
// refresh mid-signup doesn't send them back to the verify screen.
const SKIPPED_VERIFY_KEY = "delulu:skipped-verify";
/** Set until a new player joins a starter card. Brings them back to /play on the next sign-in. */
const NEEDS_STARTER_KEY = "delulu:needs-starter";

function needsStarter(address: string): boolean {
  try {
    return localStorage.getItem(NEEDS_STARTER_KEY) === address.toLowerCase();
  } catch {
    return false;
  }
}

function readSkippedVerify(address: string): boolean {
  try {
    return sessionStorage.getItem(SKIPPED_VERIFY_KEY) === address.toLowerCase();
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

  const hasOnChainUsername = typeof username === "string" && username.trim().length > 0;

  // Nothing writes the on-chain username anymore — /welcome saves it to
  // Supabase (profiles.onboarded_at) instead — so on-chain alone would send
  // every already-onboarded returning user back through the whole
  // verify/welcome flow on their next sign-in. Check the real signal too.
  const [isSupabaseOnboarded, setIsSupabaseOnboarded] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [isFetchingOnboarded, setIsFetchingOnboarded] = useState(true);
  useEffect(() => {
    if (!authenticated || !address) {
      setIsFetchingOnboarded(false);
      return;
    }
    let cancelled = false;
    setIsFetchingOnboarded(true);
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding?address=${address}`);
        const json = (await res.json()) as { onboarded?: boolean; username?: string | null };
        if (!cancelled) {
          setIsSupabaseOnboarded(Boolean(json.onboarded));
          setProfileUsername(json.username ?? null);
        }
      } catch {
        if (!cancelled) {
          setIsSupabaseOnboarded(false);
          setProfileUsername(null);
        }
      } finally {
        if (!cancelled) setIsFetchingOnboarded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, address]);

  // A name like player4a04a6 was written by signup so the form could be skipped.
  // That is not a profile. They still have to choose a username and a photo.
  const hasChosenUsername =
    !!profileUsername && !isGeneratedUsername(address ?? "", profileUsername);
  const hasProfile = (isSupabaseOnboarded && hasChosenUsername) || hasOnChainUsername;
  const mustChooseProfile = isSupabaseOnboarded && !hasChosenUsername && !hasOnChainUsername;

  // Routing and the main-app OnboardingGate ((main)/layout.tsx) MUST agree on
  // who gets in — when they disagreed, the two bounced users between each
  // other in an endless "Checking your account…" loop. Both now let in any
  // wallet with a profile; verification only decides the signup path. The
  // read-only identity check avoids waiting on the ClaimSDK, which needs a
  // live signing wallet and can leave this page spinning forever.
  const {
    identityState,
    isLoading: isIdentityLoading,
    refresh: refreshIdentity,
  } = useIdentity();
  // Still consulted after the in-page verify flow, which updates this first.
  const { isWhitelisted: isClaimWhitelisted, refreshStatus: refreshClaimStatus } =
    useGoodDollarClaim();

  const isWhitelisted = identityState.state === "verified" || isClaimWhitelisted;

  const [skippedVerify, setSkippedVerify] = useState(false);
  useEffect(() => {
    setSkippedVerify(!!address && readSkippedVerify(address));
  }, [address]);
  /** Call once the gas faucet has funded the wallet: continue to /welcome unverified. */
  const skipVerification = useCallback(() => {
    if (!address) return;
    try {
      sessionStorage.setItem(SKIPPED_VERIFY_KEY, address.toLowerCase());
    } catch {
      // Storage blocked — the in-memory flag still carries this visit.
    }
    setSkippedVerify(true);
  }, [address]);

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
    if (isFetchingUsername || isFetchingOnboarded || isIdentityLoading) {
      setRouteState("loading");
      return;
    }

    // Face verification only unlocks free daily money — it never blocks the
    // app. A profile is all it takes to get in (mirrors OnboardingGate).
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
      // Still on the starter cards: top the wallet up to 0.6 CELO. Face-verified
      // signups used to skip this, so a 0.3 GoodDollar drip was all they got.
      if ((isWhitelisted || skippedVerify) && needsStarter(address)) void requestGasTopup();
      router.replace(needsStarter(address) ? "/play" : target);
      return;
    }

    // New account: the face check is how most people get gas for the profile
    // transaction (GoodDollar sends a little CELO once verified). Skipping it
    // via the gas faucet is the other way through. Someone who already has a
    // generated name already cleared this once — send them to the form.
    if (!isWhitelisted && !skippedVerify && !mustChooseProfile) {
      setRouteState("needs_ubi_claim");
      return;
    }

    // They pick their own username and photo on /welcome. Signup must not
    // invent a name or mark them onboarded before that form is saved.
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
    isFetchingOnboarded,
    isIdentityLoading,
    isWhitelisted,
    skippedVerify,
    hasProfile,
    mustChooseProfile,
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
    skipVerification,
    setupError,
    retrySetup,
    address: address ?? "",
    isCheckingAccount: isFetchingUsername || isIdentityLoading,
  };
}
