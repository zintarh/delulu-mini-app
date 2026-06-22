"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBalance, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { DELULU_ABI } from "@/lib/abi";
import { CELO_MAINNET_ID, DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { useAuth } from "@/hooks/use-auth";
import {
  consumeSignInRedirect,
  peekCommunityReferral,
  peekSignInRedirect,
  persistCommunityReferral,
  persistSignInRedirect,
  safeRedirectPath,
} from "@/lib/auth-redirect";

/** Minimum CELO balance required before onboarding (profile tx). */
const MIN_GAS_WEI = parseEther("0.01");

export type PostAuthRouteState =
  | "loading"
  | "idle"
  | "redirecting_home"
  | "redirecting_welcome"
  | "needs_gas";

export function usePostAuthRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, isReady, address } = useAuth();

  const [routeState, setRouteState] = useState<PostAuthRouteState>("idle");
  const hasRedirectedRef = useRef(false);

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

  const { data: celoBalance, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!authenticated && !!address },
  });

  const hasProfile = typeof username === "string" && username.trim().length > 0;
  const hasGas = (celoBalance?.value ?? 0n) >= MIN_GAS_WEI;

  const redirectTarget = useMemo(
    () => peekSignInRedirect() ?? safeRedirectPath(searchParams.get("redirect")) ?? "/",
    [searchParams],
  );

  useEffect(() => {
    if (!isReady || !authenticated || !address) {
      setRouteState("idle");
      hasRedirectedRef.current = false;
      return;
    }
    if (isFetchingUsername || isBalanceLoading) {
      setRouteState("loading");
      return;
    }

    if (hasProfile) {
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

    if (!hasGas) {
      setRouteState("needs_gas");
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
    isBalanceLoading,
    hasProfile,
    hasGas,
    router,
    redirectTarget,
  ]);

  return {
    routeState,
    hasProfile,
    hasGas,
    address: address ?? "",
    refetchBalance,
    isCheckingAccount: isFetchingUsername || isBalanceLoading,
  };
}
