"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

/**
 * Fully blocking — no close button, no backdrop dismiss. Shows the moment a
 * wallet has been granted the one-time onboarding gift (verified +
 * joined a campaign) and hasn't claimed it yet; disappears for good once
 * they claim. Mounted app-wide in the main layout.
 */
export function OnboardingGiftModal() {
  const { address, authenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [mustClaim, setMustClaim] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [checked, setChecked] = useState(false);

  const { pending, refetch: refetchPending } = usePendingReward(
    address as `0x${string}` | undefined,
    GOOD_DOLLAR,
  );
  const { claimReward, isPending, error } = useClaimReward();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authenticated || !address) {
      setChecked(true);
      setMustClaim(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding/gift/status?address=${address}`);
        const json = (await res.json()) as { mustClaim?: boolean; amount?: number };
        if (cancelled) return;
        setMustClaim(Boolean(json.mustClaim));
        if (json.amount) setAmount(json.amount);
      } catch {
        // Fails closed — never block the app over a status-check network error.
        if (!cancelled) setMustClaim(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, address]);

  const handleClaim = async () => {
    if (!address) return;
    try {
      await claimReward(GOOD_DOLLAR);
      await fetch("/api/onboarding/gift/mark-claimed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setMustClaim(false);
      await refetchPending();
    } catch {
      // Surfaced below via `error` from useClaimReward.
    }
  };

  if (!mounted || !checked || !mustClaim) return null;

  const rewardNotYetOnChain = pending <= 0n;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-delulu-green/10">
          <Gift className="h-8 w-8 text-delulu-green" strokeWidth={2} />
        </div>

        <h2 className="mt-4 text-xl font-black text-foreground">Welcome gift</h2>
        <p className="mt-4 text-4xl font-black tabular-nums text-foreground">
          {amount.toLocaleString()} <span className="text-lg font-bold text-muted-foreground">G$</span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You verified your identity and joined a campaign — this one's on us. Claim it to keep
          using the app.
        </p>

        {error ? (
          <p className="mt-3 text-xs text-destructive">
            {error instanceof Error ? error.message : "Claim failed — try again"}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleClaim}
          disabled={isPending || rewardNotYetOnChain}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-delulu-green px-4 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gift className="h-4 w-4" strokeWidth={2} />
          )}
          {isPending
            ? "Claiming…"
            : rewardNotYetOnChain
              ? "Preparing your gift…"
              : `Claim ${amount.toLocaleString()} G$`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
