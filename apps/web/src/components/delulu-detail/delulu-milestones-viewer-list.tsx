"use client";

import { Check } from "lucide-react";
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
  return (
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
