"use client";

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
          "fixed left-1/2 z-[90] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 text-left",
          isLowGas
            ? "bottom-40 lg:bottom-24 lg:left-auto lg:right-6 lg:translate-x-0"
            : "bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0",
          "flex items-center gap-2.5 rounded-xl border border-delulu-green/30 bg-delulu-green/12 px-4 py-3 shadow-lg backdrop-blur-sm",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
          "transition-colors hover:bg-delulu-green/18",
        )}
      >
        <Gift className="h-4 w-4 shrink-0 text-delulu-green" strokeWidth={2} />
        <span className="flex-1 text-sm font-semibold leading-snug text-foreground">
          {amount} G$ ready to claim
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-foreground">Claim your reward</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-5 text-center text-4xl font-black tabular-nums text-foreground">
              {amount} <span className="text-lg font-bold text-muted-foreground">G$</span>
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Earned from referrals and app rewards
            </p>

            {error ? (
              <p className="mt-3 text-center text-xs text-destructive">
                {error instanceof Error ? error.message : "Claim failed"}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleClaim}
              disabled={isPending}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-delulu-green px-4 py-3.5 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
