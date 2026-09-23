"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export type PostAuthRouteState =
  | "loading"
  | "idle"
  | "redirecting_home"
  | "redirecting_welcome"
  | "needs_ubi_claim";

export function usePostAuthRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, isReady, address } = useAuth();

  const [routeState, setRouteState] = useState<PostAuthRouteState>("idle");
  const hasRedirectedRef = useRef(false);
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

  // Routing reads the same read-only identity check as the main-app
  // OnboardingGate ((main)/layout.tsx). The two MUST agree: when this page
  // sent a profile-but-never-verified user home, the gate sent them straight
  // back here — an endless "Checking your account…" reload loop. It also
  // avoids waiting on the ClaimSDK, which needs a live signing wallet and
  // can leave this page spinning forever while the wallet client settles.
  const {
    identityState,
    isLoading: isIdentityLoading,
    identityCheckFailed,
    refresh: refreshIdentity,
  } = useIdentity();
  // Still consulted after the in-page verify flow, which updates this first.
  const { isWhitelisted: isClaimWhitelisted, refreshStatus: refreshClaimStatus } =
    useGoodDollarClaim();

  const isWhitelisted = identityState.state === "verified" || isClaimWhitelisted;
  // Mirrors OnboardingGate: a failed check is inconclusive, never grounds to block.
  const passesGate = identityState.state !== "none" || isClaimWhitelisted || identityCheckFailed;

  const refreshGoodDollarStatus = async () => {
    await Promise.all([refreshClaimStatus(), refreshIdentity()]);
  };

  const redirectTarget = useMemo(
    () => peekSignInRedirect() ?? safeRedirectPath(searchParams.get("redirect")) ?? "/",
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

    if (hasProfile && passesGate) {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;

      const referral = peekCommunityReferral();
      let target = redirectTarget;
      if (referral && (target === "/" || !target.startsWith("/join/"))) {
        target = `/join/${referral}`;
      }

      consumeSignInRedirect();
      setRouteState("redirecting_home");
      // Preload main shell so home content isn't blocked behind a dynamic chunk.
      void import("@/components/main-app-header");
      router.replace(target);
      return;
    }

    if (!isWhitelisted) {
      setRouteState("needs_ubi_claim");
      return;
    }

    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    setRouteState("redirecting_welcome");
    router.replace("/welcome");
  }, [
    isReady,
    authenticated,
    address,
    isFetchingUsername,
    isFetchingOnboarded,
    isIdentityLoading,
    isWhitelisted,
    passesGate,
    hasProfile,
    router,
    redirectTarget,
  ]);

  return {
    routeState,
    hasProfile,
    isWhitelisted,
    refreshGoodDollarStatus,
    address: address ?? "",
    isCheckingAccount: isFetchingUsername || isIdentityLoading,
  };
}
