"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Hourglass,
  Loader2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatMilestoneCountdown,
  formatResolutionEndsLine,
} from "@/lib/milestone-utils";
import type {
  DeluluMilestoneTracker,
  MilestoneTrackerStep,
  MilestoneTrackerSummary,
  MilestoneStepStatus,
} from "@/hooks/use-user-ongoing-milestones";

function progressPct(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function stepStatusLabel(status: MilestoneStepStatus) {
  switch (status) {
    case "completed":
      return "Done";
    case "due":
      return "Submit proof";
    case "review":
      return "In review";
    case "upcoming":
      return "Up next";
    case "expired":
      return "Missed";
    default:
      return "";
  }
}

function stepStatusClasses(status: MilestoneStepStatus) {
  switch (status) {
    case "completed":
      return "bg-delulu-blue-light text-delulu-blue border-delulu-blue-border";
    case "due":
      return "bg-delulu-blue-light text-delulu-blue border-delulu-blue-border";
    case "review":
      return "bg-delulu-blue-light/90 text-delulu-blue border-delulu-blue-border";
    case "upcoming":
      return "bg-muted/50 text-muted-foreground border-border/60";
    case "expired":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function MilestoneSegmentBar({
  completed,
  total,
  hasDue,
  compact = false,
}: {
  completed: number;
  total: number;
  hasDue: boolean;
  compact?: boolean;
}) {
  if (total <= 0) return null;
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < completed;
        const isNext = i === completed && hasDue;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors",
              compact ? "h-1" : "h-1.5",
              done
                ? "bg-delulu-blue"
                : isNext
                  ? "bg-delulu-blue ring-1 ring-delulu-blue-border"
                  : "bg-border/80",
            )}
          />
        );
      })}
    </div>
  );
}

/** Slim one-line summary for the home dashboard */
export function MilestoneTrackerSummaryBar({
  summary,
}: {
  summary: MilestoneTrackerSummary;
}) {
  const pct = progressPct(summary.completedMilestones, summary.totalMilestones);
  const hasDue = summary.dueNow > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold text-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {hasDue
            ? `${summary.dueNow} ${summary.dueNow === 1 ? "milestone needs" : "milestones need"} proof`
            : "You're caught up"}
        </p>
        <p
          className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {summary.completedMilestones}/{summary.totalMilestones} · {pct}%
        </p>
      </div>
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-delulu-blue transition-all duration-500"
          style={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
        />
      </div>
    </div>
  );
}

export function MilestoneTrackerHero({
  summary,
  compact = false,
}: {
  summary: MilestoneTrackerSummary;
  compact?: boolean;
}) {
  const pct = progressPct(summary.completedMilestones, summary.totalMilestones);
  const hasDue = summary.dueNow > 0;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/50 bg-card shadow-[0_4px_24px_rgba(0,0,0,0.06)]",
        compact ? "px-4 py-4" : "px-5 py-6",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.18)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-6 bottom-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.12)_0%,transparent_70%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Milestone tracker
          </p>
          {hasDue ? (
            <>
              <p
                className={cn(
                  "mt-2 font-black leading-none tabular-nums text-foreground",
                  compact ? "text-4xl" : "text-5xl sm:text-6xl",
                )}
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {summary.dueNow}
              </p>
              <p
                className="mt-1 text-base font-semibold text-foreground"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {summary.dueNow === 1 ? "needs your proof" : "need your proof"}
              </p>
            </>
          ) : (
            <>
              <p
                className="mt-2 text-2xl font-black text-foreground sm:text-3xl"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                You&apos;re caught up
              </p>
              <p
                className="mt-1 text-sm text-muted-foreground"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Nothing due right now — nice work.
              </p>
            </>
          )}
        </div>

        <div className="shrink-0 rounded-2xl border border-delulu-blue-border bg-delulu-blue-light px-4 py-3 text-center sm:min-w-[7.5rem]">
          <p
            className="text-[10px] font-bold uppercase tracking-wide text-delulu-blue"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Total
          </p>
          <p
            className="mt-0.5 text-2xl font-black tabular-nums text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {summary.completedMilestones}
            <span className="text-lg font-bold text-muted-foreground">
              /{summary.totalMilestones}
            </span>
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">{pct}%</p>
        </div>
      </div>

      <div className="relative mt-5">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-delulu-blue transition-all duration-700 ease-out"
            style={{ width: `${pct > 0 ? Math.max(pct, 5) : 0}%` }}
          />
        </div>
        <div
          className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {summary.underReview > 0 ? (
            <span className="inline-flex items-center gap-1 text-delulu-blue">
              <Hourglass className="h-3 w-3" />
              {summary.underReview} in review
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" />
            {summary.activeDeluluCount}{" "}
            {summary.activeDeluluCount === 1 ? "delulu" : "delulus"}
          </span>
        </div>
      </div>
    </header>
  );
}

function TimelineNode({
  status,
  index,
  compact = false,
}: {
  status: MilestoneStepStatus;
  index: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        compact ? "h-8 w-8" : "h-9 w-9",
        status === "completed"
          ? "border-delulu-blue bg-delulu-blue text-white"
          : status === "due"
            ? "border-delulu-blue bg-delulu-blue text-white shadow-sm"
            : status === "review"
              ? "border-delulu-blue-border bg-delulu-blue-light text-delulu-blue"
              : "border-border bg-card text-muted-foreground",
      )}
    >
      {status === "completed" ? (
        <Check className={cn(compact ? "h-3 w-3" : "h-4 w-4", "stroke-[3]")} />
      ) : status === "review" ? (
        <Hourglass className={compact ? "h-3 w-3" : "h-4 w-4"} />
      ) : (
        <span
          className={cn("font-black tabular-nums", compact ? "text-[10px]" : "text-xs")}
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          {index}
        </span>
      )}
    </div>
  );
}

function TimelineStepRow({
  step,
  now,
  isLast,
  onSubmitDue,
  compact = false,
}: {
  step: MilestoneTrackerStep;
  now: number;
  isLast: boolean;
  onSubmitDue?: () => void;
  compact?: boolean;
}) {
  const countdown =
    step.status === "due" || step.status === "review"
      ? formatMilestoneCountdown(now, step.endTimeMs)
      : null;
  const urgent =
    step.status === "due" &&
    step.endTimeMs - now > 0 &&
    step.endTimeMs - now < 24 * 60 * 60 * 1000;

  return (
    <div className={cn("flex", compact ? "gap-2" : "gap-3")}>
      <div className="flex flex-col items-center">
        <TimelineNode status={step.status} index={step.index} compact={compact} />
        {!isLast ? (
          <div
            className={cn(
              "my-0.5 w-0.5 flex-1 rounded-full",
              compact ? "min-h-[1rem]" : "min-h-[1.5rem]",
              step.status === "completed" ? "bg-delulu-blue" : "bg-border",
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border transition-colors",
          compact ? "mb-2.5 p-3" : "mb-3 rounded-2xl p-3.5",
          step.status === "due"
            ? "border-delulu-blue-border bg-delulu-blue-light/60 shadow-sm"
            : step.status === "completed"
              ? "border-delulu-blue-border/50 bg-card"
              : "border-border/50 bg-muted/15",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-semibold leading-snug",
              compact ? "text-[13px]" : "text-sm",
              step.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
            )}
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {step.label}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full border font-bold",
              compact ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]",
              stepStatusClasses(step.status),
            )}
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {stepStatusLabel(step.status)}
          </span>
        </div>

        {countdown && step.status !== "upcoming" ? (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-[11px] font-semibold tabular-nums",
              urgent ? "text-orange-600" : "text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3 shrink-0" />
            {countdown}
          </p>
        ) : null}

        {step.status === "due" && onSubmitDue ? (
          <button
            type="button"
            onClick={onSubmitDue}
            className={cn(
              "mt-2 w-full rounded-full bg-delulu-blue font-bold text-white shadow-sm transition-colors hover:bg-delulu-blue/90 active:scale-[0.98]",
              compact ? "py-2.5 text-xs" : "mt-3 py-2.5 text-sm",
            )}
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Submit proof
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DeluluJourneyCard({
  tracker,
  now,
  onSubmitDue,
  compact = false,
}: {
  tracker: DeluluMilestoneTracker;
  now: number;
  onSubmitDue: (key: string) => void;
  compact?: boolean;
}) {
  const [milestonesExpanded, setMilestonesExpanded] = useState(false);
  const pct = progressPct(tracker.completed, tracker.total);
  const endsLine = formatResolutionEndsLine(now, tracker.resolutionDeadline);

  const collapsedSteps = (() => {
    const actionSteps = tracker.steps.filter(
      (s) => s.status === "due" || s.status === "review",
    );
    if (actionSteps.length > 0) return actionSteps;
    const nextUp = tracker.steps.find((s) => s.status === "upcoming");
    if (nextUp) return [nextUp];
    const lastDone = [...tracker.steps]
      .reverse()
      .find((s) => s.status === "completed");
    return lastDone ? [lastDone] : tracker.steps.slice(0, 1);
  })();

  const visibleSteps =
    compact && !milestonesExpanded ? collapsedSteps : tracker.steps;
  const hasHiddenMilestones =
    compact && tracker.steps.length > collapsedSteps.length;

  return (
    <article
      className={cn(
        "overflow-hidden border border-border/40 bg-card",
        compact
          ? "rounded-xl shadow-sm"
          : "rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.05)] sm:rounded-3xl",
      )}
    >
      <div
        className={cn(
          "border-b border-border/40 bg-gradient-to-br from-delulu-blue-light/80 via-card to-card",
          compact ? "px-3.5 py-3" : "px-4 py-4 sm:px-5",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <Link
              href={tracker.deluluHref}
              className="group inline-flex max-w-full items-start gap-1"
            >
              <h3
                className={cn(
                  "font-black leading-snug text-foreground line-clamp-2 group-hover:text-delulu-blue transition-colors",
                  compact ? "text-sm" : "text-base sm:text-lg",
                )}
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {tracker.title}
              </h3>
              <ChevronRight
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
                  compact ? "mt-0.5 h-4 w-4" : "mt-1 h-4 w-4",
                )}
              />
            </Link>
            <p
              className={cn(
                "font-medium text-muted-foreground",
                compact ? "mt-1 text-[11px]" : "mt-1 text-xs",
              )}
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {tracker.completed} of {tracker.total} · {pct}%
              {compact ? (
                <>
                  {" · "}
                  <span className="text-foreground/80">
                    {endsLine.prefix} {endsLine.value}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          {!compact ? (
            <div
              className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-delulu-blue-border bg-white/80 shadow-sm"
              aria-label={`${tracker.completed} of ${tracker.total} milestones`}
            >
              <span
                className="text-sm font-black tabular-nums leading-none text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {tracker.completed}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">
                /{tracker.total}
              </span>
            </div>
          ) : null}
        </div>
        <div className={compact ? "mt-2" : "mt-0"}>
          <MilestoneSegmentBar
            completed={tracker.completed}
            total={tracker.total}
            hasDue={tracker.due.length > 0}
            compact={compact}
          />
        </div>
      </div>

      <div className={cn(compact ? "px-3.5 py-3" : "px-4 py-4 sm:px-5")}>
        {visibleSteps.length > 0 ? (
          <div className="pt-0.5">
            {visibleSteps.map((step, i) => (
              <TimelineStepRow
                key={step.key}
                step={step}
                now={now}
                isLast={i === visibleSteps.length - 1}
                compact={compact}
                onSubmitDue={
                  step.status === "due" && step.due
                    ? () => onSubmitDue(step.key)
                    : undefined
                }
              />
            ))}
            {hasHiddenMilestones ? (
              <button
                type="button"
                onClick={() => setMilestonesExpanded((open) => !open)}
                className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border/40 pt-3 text-xs font-semibold text-delulu-blue transition-colors hover:text-delulu-blue/80"
                style={{ fontFamily: "var(--font-manrope)" }}
                aria-expanded={milestonesExpanded}
              >
                {milestonesExpanded
                  ? "Show less"
                  : `View all ${tracker.total} milestones`}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    milestonesExpanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </div>
        ) : (
          <p
            className="py-2 text-center text-sm text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            No milestones on this delulu
          </p>
        )}
      </div>
    </article>
  );
}

export function MilestoneTrackerSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto max-w-2xl space-y-4 xl:max-w-3xl",
        compact ? "px-4 pb-4" : "max-w-xl space-y-5 px-4 py-6",
      )}
    >
      {compact ? null : (
        <div
          className="flex flex-col items-center justify-center gap-3 py-8"
          role="status"
          aria-live="polite"
          aria-label="Loading milestones"
        >
          <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
          <p
            className="text-sm font-semibold text-muted-foreground"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Loading milestones…
          </p>
        </div>
      )}
      <div
        className={cn(
          "animate-pulse rounded-xl bg-muted/80",
          compact ? "h-10" : "h-36 rounded-3xl",
        )}
      />
      {[1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-xl bg-muted/60",
            compact ? "h-32" : "h-56 rounded-3xl",
          )}
        />
      ))}
    </div>
  );
}

export function MilestoneTrackerEmpty({
  onCreateClick,
  compact = false,
}: {
  onCreateClick?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center px-4 text-center",
        compact ? "py-8" : "py-16",
      )}
    >
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border/60 bg-delulu-blue-light shadow-sm">
        <Target className="h-9 w-9 text-delulu-blue" strokeWidth={2} />
      </div>
      <p
        className="text-xl font-black text-foreground"
        style={{ fontFamily: '"Clash Display", sans-serif' }}
      >
        No milestones yet
      </p>
      <p
        className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Add milestones when you create a delulu — they&apos;ll show up here with progress and proof reminders.
      </p>
      {onCreateClick ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="mt-8 rounded-full bg-delulu-blue px-7 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-delulu-blue/90 active:scale-[0.98]"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Create a delulu
        </button>
      ) : null}
    </div>
  );
}
