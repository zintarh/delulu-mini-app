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
  peekReferralCode,
  persistCommunityReferral,
  persistSignInRedirect,
  safeRedirectPath,
} from "@/lib/auth-redirect";
import { markGatePassed } from "@/lib/app-gate-pass";

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
  const { authenticated, isReady, address, email: authEmail, provider: authProvider } = useAuth();

  const [routeState, setRouteState] = useState<PostAuthRouteState>("idle");
  const hasRedirectedRef = useRef(false);
  const setupFailedRef = useRef(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupAttempt, setSetupAttempt] = useState(0);
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
        const json = (await res.json()) as { onboarded?: boolean };
        if (!cancelled) setIsSupabaseOnboarded(Boolean(json.onboarded));
      } catch {
        if (!cancelled) setIsSupabaseOnboarded(false);
      } finally {
        if (!cancelled) setIsFetchingOnboarded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, address]);

  const hasProfile = isSupabaseOnboarded || hasOnChainUsername;

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
      router.replace(needsStarter(address) ? "/play" : target);
      return;
    }

    // New account: the face check is how most people get gas for the profile
    // transaction (GoodDollar sends a little CELO once verified). Skipping it
    // via the gas faucet is the other way through.
    if (!isWhitelisted && !skippedVerify) {
      setRouteState("needs_ubi_claim");
      return;
    }

    // New account, face check done (or skipped): skip the profile form and open
    // the four starter cards. Claiming today's G$ and joining one is the
    // interaction GoodDollar looks for. The profile row is created here so
    // the app gate lets them in.
    if (hasRedirectedRef.current || setupFailedRef.current) return;
    hasRedirectedRef.current = true;
    setRouteState("redirecting_welcome");
    void (async () => {
      try {
        const email = authEmail?.includes("@") ? authEmail : `${address.toLowerCase()}@wallet.local`;
        const username = `player${address.slice(2, 8).toLowerCase()}`;
        const profileRes = await fetch("/api/profile", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            username,
            email,
            auth_provider: authProvider ?? "web3auth",
            referredByCode: peekReferralCode() ?? undefined,
          }),
        });
        if (!profileRes.ok && profileRes.status !== 409) {
          const json = (await profileRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || "Couldn't finish setting up your account.");
        }
        const onRes = await fetch("/api/onboarding", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, auth_provider: authProvider ?? "web3auth" }),
        });
        if (!onRes.ok) throw new Error("Couldn't open your cards. Try again.");
        markGatePassed(address);
        consumeSignInRedirect();
        try {
          localStorage.setItem(NEEDS_STARTER_KEY, address.toLowerCase());
        } catch {
          /* private mode: this visit still opens the cards */
        }
        router.replace("/play");
      } catch (err) {
        hasRedirectedRef.current = false;
        setupFailedRef.current = true;
        setSetupError(err instanceof Error ? err.message : "Couldn't open your cards. Try again.");
        setRouteState("idle");
      }
    })();
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
    router,
    redirectTarget,
    authEmail,
    authProvider,
    setupAttempt,
  ]);

  const retrySetup = useCallback(() => {
    setupFailedRef.current = false;
    hasRedirectedRef.current = false;
    setSetupError(null);
    setSetupAttempt((n) => n + 1);
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
