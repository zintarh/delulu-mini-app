"use client";

import { Loader2, Trophy, XCircle } from "lucide-react";
import { cn, formatGAmount } from "@/lib/utils";

export function DeluluClaimSection({
  isCreator,
  isLoadingClaimableAmount,
  displayedClaimAmount,
  tokenSymbol,
  usdLabel,
  isClaimed,
  isClaimSuccess,
  isClaiming,
  isClaimConfirming,
  canAttemptClaim,
  onChainResolutionReached,
  claimUiEnded,
  creatorClaimHint,
  claimError,
  onClaim,
}: {
  isCreator: boolean;
  isLoadingClaimableAmount: boolean;
  displayedClaimAmount: number;
  tokenSymbol: string;
  usdLabel: string | null;
  isClaimed: boolean;
  isClaimSuccess: boolean;
  isClaiming: boolean;
  isClaimConfirming: boolean;
  canAttemptClaim: boolean;
  onChainResolutionReached: boolean;
  claimUiEnded: boolean;
  creatorClaimHint: string | null | undefined;
  claimError: unknown;
  onClaim: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 md:p-4 shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 md:gap-4 items-end">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-delulu-yellow-reserved/15 border border-delulu-yellow-reserved/35">
                <Trophy className="w-3.5 h-3.5 text-delulu-yellow-reserved" />
              </span>
              <p className="text-[11px] uppercase tracking-[0.16em] font-black text-muted-foreground truncate">
                {isCreator ? "Earnings" : "Claimable"}
              </p>
            </div>
          </div>

          <p className="mt-1 text-[11px] text-muted-foreground">
            {isCreator ? "Your reward" : "Your share"}
          </p>

          {isLoadingClaimableAmount ? (
            <div className="mt-2 h-9 w-28 bg-muted animate-pulse rounded-md" />
          ) : (
            <div className="mt-1.5 flex items-end gap-2">
              <span className="text-[1.9rem] leading-none font-black tabular-nums text-foreground">
                {formatGAmount(displayedClaimAmount)}
              </span>
              <span className="pb-1 text-sm font-semibold text-muted-foreground">
                {tokenSymbol}
              </span>
              {usdLabel ? (
                <span className="pb-1 ml-1 text-xs text-muted-foreground tabular-nums">
                  ≈ ${usdLabel}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end">
          {isClaimed || isClaimSuccess ? (
            <div className="h-11 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-semibold flex items-center justify-center">
              Claimed
            </div>
          ) : (
            <button
              type="button"
              onClick={onClaim}
              disabled={isClaiming || isClaimConfirming || !canAttemptClaim}
              className={cn(
                "w-fit px-6 h-11 rounded-xl border-2 text-sm font-black",
                "flex items-center justify-center gap-2",
                "transition-all duration-200 active:translate-y-px",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "border-[#1d3b2f] bg-delulu-yellow-reserved text-black shadow-[2px_2px_0px_0px_#0b1f15] hover:brightness-95",
              )}
            >
              {(isClaiming || isClaimConfirming) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isClaiming
                ? "Confirm"
                : isClaimConfirming
                  ? "Processing"
                  : canAttemptClaim
                    ? "Claim"
                    : !onChainResolutionReached
                      ? "Pending"
                      : "No claim"}
            </button>
          )}
        </div>
      </div>

      {claimError ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-2">
          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive font-medium leading-snug">
            {(claimError as { shortMessage?: string; message?: string })
              ?.shortMessage ??
              (claimError as { message?: string })?.message ??
              "Claim failed"}
          </p>
        </div>
      ) : null}

      {!canAttemptClaim &&
        claimUiEnded &&
        !isClaiming &&
        !isClaimConfirming &&
        !isClaimSuccess &&
        !isClaimed && (
          <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
            <p className="text-xs text-amber-700 leading-snug">
              {creatorClaimHint ??
                "Refresh the page and confirm you are on the correct network with the wallet that created this delulu."}
            </p>
          </div>
        )}
    </div>
  );
}
