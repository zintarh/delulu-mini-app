"use client";

import { useState } from "react";
import { Check, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatMilestoneCountdown,
  getMilestoneLabel,
} from "@/lib/milestone-utils";
import type { GraphMilestone } from "@/hooks/graph/useGraphDelulu";

function statusMeta(
  m: GraphMilestone,
  isPast: boolean,
  isOngoing: boolean,
  isUpcoming: boolean,
) {
  if (m.isVerified) {
    return { label: "Completed", className: "bg-delulu-blue-light text-delulu-blue border-delulu-blue-border" };
  }
  if (isOngoing && m.isSubmitted) {
    return { label: "Under review", className: "bg-delulu-blue-light/80 text-delulu-blue border-delulu-blue-border" };
  }
  if (isPast && m.isSubmitted) {
    return { label: "In review", className: "bg-delulu-blue-light/80 text-delulu-blue border-delulu-blue-border" };
  }
  if (isPast) {
    return { label: "Expired", className: "bg-muted text-muted-foreground border-border" };
  }
  if (isOngoing) {
    return { label: "In progress", className: "bg-delulu-blue-light text-delulu-blue border-delulu-blue-border" };
  }
  if (isUpcoming) {
    return { label: "Upcoming", className: "bg-muted/60 text-muted-foreground border-border/50" };
  }
  return { label: "Pending", className: "bg-secondary text-muted-foreground border-border" };
}

function ProofLightbox({
  proofUrl,
  onClose,
}: {
  proofUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      <div
        className="flex max-h-[90vh] max-w-full items-center justify-center overflow-hidden rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={proofUrl}
          alt="Milestone evidence"
          className="block h-full max-h-[90vh] w-auto max-w-[90vw] object-contain"
        />
      </div>
    </div>
  );
}

export interface DeluluMilestonesViewerListProps {
  milestones: GraphMilestone[];
  endTimesMs: number[];
  currentIndex: number;
  now: number;
}

export function DeluluMilestonesViewerList({
  milestones,
  endTimesMs,
  currentIndex,
  now,
}: DeluluMilestonesViewerListProps) {
  const [viewingProof, setViewingProof] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-0 pt-1">
        {milestones.map((m, i) => {
          const endTimeMs = endTimesMs[i] ?? m.deadline.getTime();
          const shortTitle = getMilestoneLabel(m, 80);

          const isPast =
            m.isVerified ||
            currentIndex === -1 ||
            i < currentIndex;
          const isOngoing = i === currentIndex && !m.isVerified;
          const isUpcoming = !isPast && !isOngoing;

          const status = statusMeta(m, isPast, isOngoing, isUpcoming);
          const isLast = i === milestones.length - 1;

          const timeLeft = formatMilestoneCountdown(now, endTimeMs);
          const showTime =
            (isOngoing || (isPast && m.isSubmitted && !m.isVerified)) &&
            timeLeft !== "Ended";

          const hasProof = (m.isSubmitted || m.isVerified) && !!m.proofLink;

          return (
            <div key={m.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    m.isVerified
                      ? "border-delulu-blue bg-delulu-blue text-white"
                      : isOngoing
                        ? "border-delulu-blue bg-delulu-blue-light text-delulu-blue"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {m.isVerified ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <span className="text-xs font-black tabular-nums">{i + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "my-1 w-0.5 flex-1 min-h-[1.25rem] rounded-full",
                      m.isVerified ? "bg-delulu-blue" : "bg-border",
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  "mb-4 min-w-0 flex-1 rounded-xl border p-3",
                  isOngoing
                    ? "border-delulu-blue-border bg-delulu-blue-light/50"
                    : m.isVerified
                      ? "border-delulu-blue-border/60 bg-card"
                      : "border-border/50 bg-muted/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      isUpcoming ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {shortTitle}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      status.className,
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {showTime ? (
                  <p className="mt-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {timeLeft}
                  </p>
                ) : null}

                {hasProof && (
                  <button
                    type="button"
                    onClick={() => setViewingProof(m.proofLink!)}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-delulu-blue-border bg-delulu-blue-light px-2.5 py-1 text-[11px] font-semibold text-delulu-blue transition-all hover:bg-delulu-blue hover:text-white active:scale-95"
                  >
                    <Eye className="h-3 w-3" strokeWidth={2.5} />
                    View evidence
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewingProof && (
        <ProofLightbox
          proofUrl={viewingProof}
          onClose={() => setViewingProof(null)}
        />
      )}
    </>
  );
}
