"use client";

import { Loader2, Shield, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type CampaignJoinInfo = {
  title: string;
  communityName: string;
  milestoneCount: number;
  durationDays: number;
  isFreeToJoin: boolean;
  joinToken?: string;
  joinAmount?: number;
  forfeitPct?: number;
  proposedPoolAmount: number;
  prizeWinnerCount: number;
  isFunded: boolean;
};

export function CampaignJoinModal({
  open,
  info,
  joining,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  info: CampaignJoinInfo;
  joining: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const hasForfeit = !info.isFreeToJoin && (info.forfeitPct ?? 0) > 0;
  const forfeitPerMiss =
    hasForfeit && info.joinAmount
      ? ((info.joinAmount * (info.forfeitPct ?? 0)) / 100).toFixed(2)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={joining ? undefined : onCancel}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-background px-5 pt-6 pb-safe-bottom sm:pb-6 shadow-xl">
        {/* Drag pill */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />

        <h2 className="text-lg font-black text-foreground">{info.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">by {info.communityName}</p>

        <div className="mt-5 space-y-3">
          {/* Entry */}
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Entry
            </p>
            {info.isFreeToJoin ? (
              <p className="text-sm font-semibold text-foreground">Free to join</p>
            ) : (
              <p className="text-sm font-semibold text-foreground">
                Stake {info.joinAmount} {info.joinToken ?? "G$"} to participate
              </p>
            )}
          </div>

          {/* Forfeit */}
          {hasForfeit ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-destructive" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-destructive">
                  Forfeit policy
                </p>
              </div>
              <p className="text-sm text-foreground">
                Miss a milestone → lose {info.forfeitPct}% of your stake
                {forfeitPerMiss ? ` (${forfeitPerMiss} ${info.joinToken ?? "G$"} per miss)` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Forfeits go into the prize pool for winners.
              </p>
            </div>
          ) : null}

          {/* Prize */}
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[#9a7b0a]" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Prize
              </p>
            </div>
            {info.isFunded && info.proposedPoolAmount > 0 ? (
              <p className="text-sm text-foreground">
                Funded pool: {info.proposedPoolAmount} G$
                {hasForfeit ? " + forfeit pool grows as participants miss milestones" : ""}
              </p>
            ) : hasForfeit ? (
              <p className="text-sm text-foreground">
                Forfeit pool grows as participants miss milestones
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No prize pool — earn XP and bragging rights</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Top {info.prizeWinnerCount} participants share the pool
            </div>
          </div>

          {/* Quick stats */}
          <p className="text-center text-xs text-muted-foreground">
            {info.milestoneCount} milestone{info.milestoneCount !== 1 ? "s" : ""} over{" "}
            {info.durationDays} days
          </p>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By joining, you accept the terms of this campaign.
        </p>

        <div
          className={cn(
            "mt-4 grid gap-2",
            info.isFreeToJoin ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          <button
            type="button"
            disabled={joining}
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={joining}
            onClick={onConfirm}
            className="rounded-xl bg-delulu-blue px-4 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)] hover:bg-delulu-blue/90 disabled:opacity-50 transition-colors"
          >
            {joining ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining…
              </span>
            ) : info.isFreeToJoin ? (
              "Join for free"
            ) : (
              `Stake & Join`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
