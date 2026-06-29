"use client";

import { Loader2, Target, Trophy, CalendarDays } from "lucide-react";
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
  proofCadence?: string;
  proofInstructions?: string | null;
  pointsPerMilestone?: number;
  maxForfeitTotal?: number;
  fundedPoolAmount?: number;
  totalParticipantStakes?: number;
  totalPrizePoolAmount?: number;
  participantCount?: number;
};

export function CampaignJoinModal({
  open,
  info,
  joining,
  joiningLabel,
  joinError,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  info: CampaignJoinInfo;
  joining: boolean;
  joiningLabel?: string;
  joinError?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const joinAmount = info.joinAmount ?? 0;
  const joinToken = info.joinToken ?? "G$";
  const cadenceLabel = info.proofCadence === "weekly" ? "Weekly" : "Daily";
  const fundedPool = info.fundedPoolAmount ?? info.proposedPoolAmount ?? 0;
  const participantStakes = info.totalParticipantStakes ?? 0;
  const totalPool = info.totalPrizePoolAmount ?? fundedPool + participantStakes;
  const hasPool = totalPool > 0;
  const hasForfeit = !info.isFreeToJoin && (info.forfeitPct ?? 0) > 0;
  const forfeitPerMiss =
    hasForfeit && joinAmount > 0
      ? ((joinAmount * (info.forfeitPct ?? 0)) / 100).toFixed(2)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={joining ? undefined : onCancel}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-2xl bg-background shadow-xl">
        <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="px-5 pt-4 pb-5">
          {/* Header */}
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {info.communityName}
          </p>
          <h2 className="mt-0.5 text-[17px] font-black leading-snug text-foreground">
            {info.title}
          </h2>

          {/* Stats row */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Duration</p>
              <p className="mt-0.5 text-sm font-black text-foreground">{info.durationDays}d</p>
            </div>
            <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Proofs</p>
              <p className="mt-0.5 text-sm font-black text-foreground">{cadenceLabel}</p>
            </div>
            <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[11px] text-muted-foreground">Steps</p>
              <p className="mt-0.5 text-sm font-black text-foreground">{info.milestoneCount}</p>
            </div>
          </div>

          {/* Prize pool */}
          {hasPool ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#f6c324]/30 bg-[#fffbeb] px-3 py-2.5">
              <Trophy className="h-4 w-4 shrink-0 text-[#9a7b0a]" />
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground">
                  {totalPool} {joinToken} prize pool
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Top {info.prizeWinnerCount} share the prize
                </p>
              </div>
            </div>
          ) : null}

          {/* Proof instructions */}
          {info.proofInstructions ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{info.proofInstructions}</p>
            </div>
          ) : null}

          {/* Forfeit warning — only for paid with forfeit */}
          {hasForfeit ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Miss a milestone? You forfeit {info.forfeitPct}%{forfeitPerMiss ? ` (${forfeitPerMiss} ${joinToken})` : ""} per miss to the prize pool.
            </p>
          ) : null}

          {joinError ? (
            <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
              {joinError}
            </p>
          ) : null}

          {/* Actions */}
          <div className={cn("mt-4 grid gap-2 grid-cols-2")}>
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
                  {joiningLabel ?? "Joining…"}
                </span>
              ) : info.isFreeToJoin ? (
                "Join for free"
              ) : (
                `Stake ${joinAmount} ${joinToken}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
