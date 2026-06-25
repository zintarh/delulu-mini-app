"use client";

import { Check, Clock, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import {
  canSubmitMilestone,
  formatMilestoneOpensAt,
  getActiveMilestone,
} from "@/lib/community/milestone-submit-eligibility";

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
    return { label: "Overdue", dot: "bg-destructive", ring: "border-destructive/30 bg-destructive/10" };
  }
  if (!m.deadline) {
    return { label: "Upcoming", dot: "bg-muted-foreground", ring: "border-border bg-muted/40" };
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
      <div className="relative overflow-hidden rounded-2xl border border-[#f6c324]/35 bg-gradient-to-br from-[#fffbeb] to-white px-5 py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6c324]/25 text-[#9a7b0a]">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="text-sm font-bold text-foreground">Milestones coming soon</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
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
          <li key={m.milestone_id} className="relative flex gap-4 pb-5 last:pb-0">
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
                "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black",
                m.completed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isNext
                    ? "border-delulu-blue bg-delulu-blue text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                    : "border-border bg-background text-muted-foreground",
              )}
            >
              {m.completed ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
            </div>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl border px-3.5 py-3 transition-colors",
                isNext && !m.completed
                  ? "border-delulu-blue/40 bg-delulu-blue-light/50 shadow-sm"
                  : "border-border/60 bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold leading-snug text-foreground">{m.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        meta.ring,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {formatCountdown(m.deadline)}
                  </p>
                </div>

                {isJoined && !m.completed ? (
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => onSubmitMilestone(m.milestone_id)}
                    className={cn(
                      "w-fit shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-opacity",
                      isNext
                        ? "bg-delulu-blue text-white hover:opacity-90"
                        : "border border-border bg-background text-foreground hover:bg-muted/50",
                      !canSubmit && "opacity-50",
                    )}
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        …
                      </span>
                    ) : canSubmit ? (
                      "Submit proof"
                    ) : m.start_time ? (
                      formatMilestoneOpensAt(m.start_time)
                    ) : (
                      "Not open"
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
