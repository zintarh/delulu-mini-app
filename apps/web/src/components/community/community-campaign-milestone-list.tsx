"use client";

import { Check, Clock, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import {
  canSubmitMilestone,
  formatMilestoneOpensAt,
  getActiveMilestone,
} from "@/lib/community/milestone-submit-eligibility";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

function fmtPts(n: number) {
  return n.toLocaleString();
}

function formatCountdown(deadline: string) {
  if (!deadline) return "Pending start";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.ceil(ms / 3600000);
  return `${hours}h left`;
}

function statusMeta(m: CommunityCampaignMilestoneRow) {
  if (m.completed) {
    return { label: "Complete", dot: "bg-emerald-500", ring: "border-emerald-500/30 bg-emerald-500/10" };
  }
  if (canSubmitMilestone(m)) {
    return { label: "Active", dot: "bg-delulu-blue", ring: "border-delulu-blue/30 bg-delulu-blue-light" };
  }
  const startMs = m.start_time ? new Date(m.start_time).getTime() : null;
  if (startMs != null && startMs > Date.now()) {
    return { label: "Upcoming", dot: "bg-muted-foreground", ring: "border-border bg-muted/40" };
  }
  if (m.is_overdue) {
    return { label: "Closed", dot: "bg-muted-foreground", ring: "border-border/60 bg-muted/40" };
  }
  if (!m.deadline) {
    return { label: "Upcoming", dot: "bg-muted-foreground", ring: "border-border bg-muted/40" };
  }
  if (new Date(m.deadline).getTime() < Date.now()) {
    return { label: "Closed", dot: "bg-muted-foreground", ring: "border-border/60 bg-muted/40" };
  }
  return { label: "Active", dot: "bg-delulu-blue", ring: "border-delulu-blue/30 bg-delulu-blue-light" };
}

export function CommunityCampaignMilestoneList({
  milestones,
  isJoined,
  proofBusy,
  activeMilestoneId,
  onSubmitMilestone,
}: {
  milestones: CommunityCampaignMilestoneRow[];
  isJoined: boolean;
  proofBusy: boolean;
  activeMilestoneId?: number | null;
  onSubmitMilestone: (milestoneId: number) => void;
}) {
  if (milestones.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#f6c324]/35 bg-gradient-to-br from-[#fffbeb] to-white px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6c324]/25 text-[#9a7b0a]">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-base font-bold text-foreground">Milestones coming soon</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The host is setting up checkpoints. You&apos;ll be able to join once they&apos;re live.
        </p>
      </div>
    );
  }

  const highlightMilestoneId =
    getActiveMilestone(milestones)?.milestone_id ??
    milestones.find((m) => !m.completed && !canSubmitMilestone(m))?.milestone_id ??
    null;
  const nextDueIndex = milestones.findIndex(
    (m) => m.milestone_id === highlightMilestoneId,
  );

  return (
    <ol className="relative space-y-0">
      {milestones.map((m, index) => {
        const meta = statusMeta(m);
        const isLast = index === milestones.length - 1;
        const isNext = m.milestone_id === highlightMilestoneId || index === nextDueIndex;
        const canSubmit = isJoined && canSubmitMilestone(m) && !proofBusy;
        const submitting = proofBusy && activeMilestoneId === m.milestone_id;

        return (
          <li key={m.milestone_id} className="relative flex gap-5 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-12px)] w-0.5",
                  m.completed ? "bg-emerald-500/40" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}

            <div
              className={cn(
                "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black",
                m.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isNext
                    ? "border-delulu-blue bg-delulu-blue text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {m.completed ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
            </div>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl border px-4 py-3.5 transition-colors",
                isNext && !m.completed
                  ? "border-delulu-blue/40 bg-delulu-blue-light/50 shadow-sm"
                  : "border-border/60 bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="text-base font-bold leading-snug text-foreground">{m.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
                        meta.ring,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {formatCountdown(m.deadline)}
                  </p>
                </div>

                {/* Right side — points reward or submit button */}
                {m.completed ? (
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">
                    +{fmtPts(BASE_PROOF_POINTS)} pts ✓
                  </span>
                ) : !isJoined ? (
                  <span className="shrink-0 rounded-lg bg-delulu-blue-light px-3 py-1.5 text-[11px] font-black text-delulu-blue">
                    +{fmtPts(BASE_PROOF_POINTS)} pts
                  </span>
                ) : isJoined ? (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {canSubmit || submitting ? (
                      <>
                        <span className="text-[11px] font-black text-delulu-blue">
                          +{fmtPts(BASE_PROOF_POINTS)} pts
                        </span>
                        <button
                          type="button"
                          disabled={!canSubmit}
                          onClick={() => onSubmitMilestone(m.milestone_id)}
                          className="w-fit rounded-lg bg-delulu-blue px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {submitting ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              …
                            </span>
                          ) : (
                            "Upload proof"
                          )}
                        </button>
                      </>
                    ) : m.is_overdue ? (
                      <span className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
                        −{fmtPts(BASE_PROOF_POINTS)} pts missed
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted-foreground/60">
                        +{fmtPts(BASE_PROOF_POINTS)} pts
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
