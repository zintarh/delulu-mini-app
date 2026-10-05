"use client";

import { Chest } from "@/components/ds";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import { Gift, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useHasGas } from "@/hooks/use-has-gas";
import { usePendingReward, useClaimReward } from "@/hooks/use-reward-vault";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";

const GOOD_DOLLAR = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;

/**
 * Persistent low-key banner + modal, shown app-wide whenever the signed-in
 * wallet has an unclaimed G$ balance sitting in the RewardVault — referral
 * payouts land here the same way admin grants and campaign rewards do, so
 * this is a generic "you have something to claim" prompt, not referral-only.
 */
export function RewardsClaimBanner() {
  const { address, authenticated } = useAuth();
  const { isLowGas } = useHasGas();
  const { pending, isLoading, refetch } = usePendingReward(
    address as `0x${string}` | undefined,
    GOOD_DOLLAR,
  );
  const { claimReward, isPending, error, reset } = useClaimReward();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !authenticated || !address || isLoading || pending <= 0n) return null;

  const amount = formatGAmount(parseFloat(formatUnits(pending, 18)));

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleClaim = async () => {
    try {
      await claimReward(GOOD_DOLLAR);
      await refetch();
      setOpen(false);
    } catch {
      // Surfaced below via `error` from useClaimReward.
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        role="status"
        className={cn(
          "fixed inset-x-3 z-[90] text-left sm:inset-x-auto sm:right-4 sm:w-80 lg:right-6",
          isLowGas
            ? "bottom-[calc(var(--mobile-bottom-nav-bar)+96px)] lg:bottom-24"
            : "bottom-[calc(var(--mobile-bottom-nav-bar)+24px)] lg:bottom-6",
          "press-edge flex items-center gap-3 rounded-[20px] border-2 border-green-line bg-[#f2fbf5] p-3.5 shadow-edge-green-line",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
        )}
      >
        <Chest size={40} className="animate-wiggle" />
        <span className="flex-1 text-sm font-extrabold leading-snug text-foreground">{amount} G$ ready to claim</span>
        <span className="rounded-xl bg-green px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink shadow-[0_3px_0_#1e8a52]">
          Claim
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-sm animate-sheet-up rounded-[28px] border-2 border-line bg-white p-6 shadow-[0_8px_0_#e6e6e0]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">Claim your reward</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="press-edge flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-5 text-center font-display text-5xl font-extrabold tabular-nums text-foreground">
              {amount} <span className="text-lg font-bold text-muted-foreground">G$</span>
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Earned from referrals and app rewards
            </p>

            {error ? (
              <p className="mt-3 text-center text-xs font-semibold text-orange">
                {error instanceof Error ? error.message : "Claim failed"}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleClaim}
              disabled={isPending}
              className="press-edge mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-green px-4 text-[15px] font-extrabold uppercase tracking-[0.06em] text-ink shadow-edge-green disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gift className="h-4 w-4" strokeWidth={2} />
              )}
              {isPending ? "Claiming…" : `Claim ${amount} G$`}
            </button>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
