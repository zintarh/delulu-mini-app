"use client";

import { Loader2, Wallet } from "lucide-react";
import { cn, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";

interface CampaignRefundPanelProps {
  challengeId: number;
  poolAmount: number;
  totalPoints: number;
  currencyTokenAddress?: `0x${string}`;
  canRefund: boolean;
  isRefunded: boolean;
  isLoading: boolean;
  isPending: boolean;
  isSuccess: boolean;
  errorMessage: string | null;
  onRefund: () => void;
  className?: string;
}

export function CampaignRefundPanel({
  challengeId,
  poolAmount,
  totalPoints,
  currencyTokenAddress,
  canRefund,
  isRefunded,
  isLoading,
  isPending,
  isSuccess,
  errorMessage,
  onRefund,
  className,
}: CampaignRefundPanelProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-muted/40 p-4 animate-pulse h-24",
          className,
        )}
      />
    );
  }

  if (isRefunded || isSuccess) {
    return (
      <div
        className={cn(
          "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3",
          className,
        )}
      >
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Campaign pool withdrawn
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Campaign #{challengeId} funds were sent to your wallet.
        </p>
      </div>
    );
  }

  if (!canRefund) return null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Withdraw campaign pool</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            This campaign has ended. Recover{" "}
            <span className="font-semibold text-foreground">
              {formatGAmount(poolAmount)}
            </span>{" "}
            {currencyTokenAddress ? (
              <TokenBadge tokenAddress={currencyTokenAddress} size="sm" />
            ) : (
              "G$"
            )}{" "}
            to the wallet that funded this campaign.
          </p>
          {totalPoints > 0 ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              Points were allocated on this campaign. Only withdraw if creators have
              already claimed or you intend to cancel unused rewards.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefund}
          disabled={isPending}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-delulu-charcoal",
            "bg-delulu-yellow-reserved px-5 py-2.5 text-sm font-bold text-delulu-charcoal",
            "shadow-[2px_2px_0px_0px_#1a1a19] transition-all hover:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          {isPending ? "Withdrawing…" : "Withdraw pool"}
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-3 text-xs font-medium text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
