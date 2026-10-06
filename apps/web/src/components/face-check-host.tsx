"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useFaceCheck } from "@/contexts/right-panel-context";
import { useOnboardingGiftRecheck } from "@/contexts/onboarding-gift-context";

const IdentityFlow = dynamic(() => import("@/app/(main)/daily-claim/IdentityFlow"), { ssr: false });

/**
 * GoodDollar face check opened straight from any "Verify" button (Home,
 * Rewards, Settings) — no side panel in between. After verifying it runs
 * the same follow-up as the claim panel: refresh status and re-check the
 * onboarding gift.
 */
export function FaceCheckHost() {
  const { isOpen, close } = useFaceCheck();
  const { address } = useAuth();
  const { startVerifying, stopVerifying, refreshStatus } = useGoodDollarClaim();
  const { requestRecheck } = useOnboardingGiftRecheck();

  useEffect(() => {
    if (isOpen) startVerifying();
    else stopVerifying();
  }, [isOpen, startVerifying, stopVerifying]);

  const handleVerified = useCallback(async () => {
    close();
    const status = await refreshStatus();
    if (!status.isWhitelisted || !address) return;
    try {
      await fetch("/api/onboarding/gift/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
    } catch {
      // Non-critical — OnboardingGiftModal's own re-check covers this too.
    }
    requestRecheck();
  }, [close, refreshStatus, address, requestRecheck]);

  if (!isOpen) return null;
  return (
    <IdentityFlow
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onVerified={() => void handleVerified()}
    />
  );
}
