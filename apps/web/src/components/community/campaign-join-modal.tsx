"use client";

import { Loader2, CalendarDays, Shield, Trophy, Users, Zap } from "lucide-react";
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

  const hasForfeit = !info.isFreeToJoin && (info.forfeitPct ?? 0) > 0;
  const joinAmount = info.joinAmount ?? 0;
  const joinToken = info.joinToken ?? "G$";
  const forfeitPerMiss =
    hasForfeit && joinAmount > 0
      ? ((joinAmount * (info.forfeitPct ?? 0)) / 100).toFixed(2)
      : null;
  const cadenceLabel = info.proofCadence === "weekly" ? "weekly" : "daily";
  const points = info.pointsPerMilestone ?? 1000;
  const fundedPool = info.fundedPoolAmount ?? info.proposedPoolAmount ?? 0;
  const participantStakes = info.totalParticipantStakes ?? 0;
  const totalPool = info.totalPrizePoolAmount ?? fundedPool + participantStakes;
  const stakeToken = info.joinToken ?? "G$";
  const hasPoolBreakdown = fundedPool > 0 || participantStakes > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={joining ? undefined : onCancel}
      />

      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-background px-5 pt-6 pb-safe-bottom sm:pb-6 shadow-xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border sm:hidden" />

        <h2 className="text-lg font-black text-foreground">{info.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">by {info.communityName}</p>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-delulu-blue/25 bg-delulu-blue-light/30 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-delulu-blue" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-delulu-blue">
                How it works
              </p>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              <li>
                Complete {cadenceLabel} milestones over {info.durationDays} days and earn{" "}
                <strong>{points.toLocaleString()} pts</strong> per proof.
              </li>
              <li>Submit one proof per milestone day — the next unlocks when that day starts.</li>
              <li>Climb the leaderboard; top {info.prizeWinnerCount} share prizes when the campaign ends.</li>
            </ul>
            {info.proofInstructions ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Proof tip: {info.proofInstructions}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Entry
            </p>
            {info.isFreeToJoin ? (
              <p className="text-sm font-semibold text-foreground">Free to join — no stake required</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Stake {joinAmount} {joinToken} to join
                </p>
                <p className="text-xs text-muted-foreground">
                  Your wallet will be debited when you confirm. This stake stays in the campaign until it ends.
                </p>
              </>
            )}
          </div>

          {hasForfeit ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-destructive" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-destructive">
                  If you miss a milestone
                </p>
              </div>
              <p className="text-sm text-foreground">
                You forfeit {info.forfeitPct}% of your stake per missed milestone
                {forfeitPerMiss ? ` (${forfeitPerMiss} ${joinToken} each time)` : ""}.
              </p>
              {info.maxForfeitTotal && info.maxForfeitTotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Worst case across all {info.milestoneCount} milestones: up to{" "}
                  {info.maxForfeitTotal.toFixed(2)} {joinToken} forfeited to the prize pool.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Forfeits are added to the prize pool for top finishers.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[#9a7b0a]" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Prize pool
              </p>
            </div>
            {hasPoolBreakdown ? (
              <div className="space-y-1">
                {fundedPool > 0 ? (
                  <p className="text-sm text-foreground">
                    Host funded: <strong>{fundedPool} G$</strong>
                  </p>
                ) : null}
                {participantStakes > 0 ? (
                  <p className="text-sm text-foreground">
                    Participant stakes:{" "}
                    <strong>
                      {participantStakes} {stakeToken}
                    </strong>
                    {info.participantCount
                      ? ` from ${info.participantCount} joined`
                      : ""}
                  </p>
                ) : null}
                <p className="text-sm font-semibold text-foreground">
                  Total prize pool:{" "}
                  {fundedPool > 0 && participantStakes > 0 && stakeToken !== "G$"
                    ? `${fundedPool} G$ + ${participantStakes} ${stakeToken}`
                    : `${totalPool} G$`}
                </p>
              </div>
            ) : info.isFunded && info.proposedPoolAmount > 0 ? (
              <p className="text-sm font-semibold text-foreground">
                Funded: {info.proposedPoolAmount} G$ in the pool
                {hasForfeit ? " + participant forfeits" : ""}
              </p>
            ) : hasForfeit ? (
              <p className="text-sm text-foreground">
                Pool grows from participant forfeits when milestones are missed
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No funded pool yet — compete for points and leaderboard rank
              </p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Top {info.prizeWinnerCount} on the leaderboard share the pool
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {info.milestoneCount} milestone{info.milestoneCount !== 1 ? "s" : ""} · {info.durationDays}{" "}
            days · {cadenceLabel} proofs
          </div>
        </div>

        {joinError ? (
          <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {joinError}
          </p>
        ) : null}

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By joining, you accept this campaign&apos;s rules and on-chain terms.
        </p>

        <div className={cn("mt-4 grid gap-2", "grid-cols-2")}>
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
              `Stake ${joinAmount} ${joinToken} & join`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
