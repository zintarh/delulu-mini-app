"use client";

import { useMemo, useCallback } from "react";
import { formatUnits } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useClaimPanel } from "@/contexts/right-panel-context";

export type ClaimAvailability = "loading" | "hidden" | "verify" | "claimable";

export function useClaimAvailability() {
  const { authenticated, isReady } = useAuth();
  const { open: openClaimPanel } = useClaimPanel();
  const {
    isLoading: isClaimDataLoading,
    isWhitelisted,
    entitlement,
    hasClaimed,
    isInitialized,
  } = useGoodDollarClaim();

  const entitlementDisplay = useMemo(() => {
    if (entitlement === null) return null;
    const formatted = formatUnits(entitlement, 18);
    const n = parseFloat(formatted);
    return Number.isFinite(n) ? n.toFixed(2) : null;
  }, [entitlement]);

  const availability: ClaimAvailability = useMemo(() => {
    if (!authenticated || !isReady) return "hidden";
    if (isClaimDataLoading || !isInitialized) return "loading";

    const needsWhitelist = !isWhitelisted;
    const canClaimUbi =
      isWhitelisted &&
      !hasClaimed &&
      entitlement !== null &&
      entitlement > 0n;

    if (needsWhitelist) return "verify";
    if (hasClaimed) return "hidden";
    if (canClaimUbi) return "claimable";
    return "hidden";
  }, [
    authenticated,
    isReady,
    isClaimDataLoading,
    isInitialized,
    isWhitelisted,
    hasClaimed,
    entitlement,
  ]);

  const showProfileClaim = authenticated && isReady;

  const openClaim = useCallback(() => {
    openClaimPanel();
  }, [openClaimPanel]);

  return {
    availability,
    entitlementDisplay,
    showProfileClaim,
    openClaim,
  };
}
