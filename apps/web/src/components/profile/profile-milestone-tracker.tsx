"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  Clock,
  Hourglass,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMilestoneCountdown } from "@/lib/milestone-utils";
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
}: {
  completed: number;
  total: number;
  hasDue: boolean;
}) {
  if (total <= 0) return null;
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < completed;
        const isNext = i === completed && hasDue;
        return (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
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

export function MilestoneTrackerHero({
  summary,
}: {
  summary: MilestoneTrackerSummary;
}) {
  const pct = progressPct(summary.completedMilestones, summary.totalMilestones);
  const hasDue = summary.dueNow > 0;

  return (
    <header className="relative overflow-hidden rounded-3xl border border-border/50 bg-card px-5 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
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
                className="mt-2 text-5xl font-black leading-none tabular-nums text-foreground sm:text-6xl"
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

function TimelineNode({ status, index }: { status: MilestoneStepStatus; index: number }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
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
        <Check className="h-4 w-4 stroke-[3]" />
      ) : status === "review" ? (
        <Hourglass className="h-4 w-4" />
      ) : (
        <span
          className="text-xs font-black tabular-nums"
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
}: {
  step: MilestoneTrackerStep;
  now: number;
  isLast: boolean;
  onSubmitDue?: () => void;
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
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <TimelineNode status={step.status} index={step.index} />
        {!isLast ? (
          <div
            className={cn(
              "my-1 min-h-[1.5rem] w-0.5 flex-1 rounded-full",
              step.status === "completed" ? "bg-delulu-blue" : "bg-border",
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "mb-3 min-w-0 flex-1 rounded-2xl border p-3.5 transition-colors",
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
              "text-sm font-semibold leading-snug",
              step.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
            )}
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {step.label}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
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
            className="mt-3 w-full rounded-full bg-delulu-blue py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-delulu-blue/90 active:scale-[0.98]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Submit evidence
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
}: {
  tracker: DeluluMilestoneTracker;
  now: number;
  onSubmitDue: (key: string) => void;
}) {
  const pct = progressPct(tracker.completed, tracker.total);

  return (
    <article className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
      <div className="border-b border-border/40 bg-gradient-to-br from-delulu-blue-light/80 via-card to-card px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={tracker.deluluHref}
              className="group inline-flex max-w-full items-start gap-1.5"
            >
              <h3
                className="text-base font-black leading-snug text-foreground line-clamp-2 group-hover:text-delulu-blue transition-colors sm:text-lg"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {tracker.title}
              </h3>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p
              className="mt-1 text-xs font-medium text-muted-foreground"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {tracker.completed} of {tracker.total} complete · {pct}%
            </p>
          </div>
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
        </div>
        <MilestoneSegmentBar
          completed={tracker.completed}
          total={tracker.total}
          hasDue={tracker.due.length > 0}
        />
      </div>

      <div className="px-4 py-4 sm:px-5">
        {tracker.steps.length > 0 ? (
          <div className="pt-0.5">
            {tracker.steps.map((step, i) => (
              <TimelineStepRow
                key={step.key}
                step={step}
                now={now}
                isLast={i === tracker.steps.length - 1}
                onSubmitDue={
                  step.status === "due" && step.due
                    ? () => onSubmitDue(step.key)
                    : undefined
                }
              />
            ))}
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

export function MilestoneTrackerSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <div className="h-36 animate-pulse rounded-3xl bg-muted/80" />
      {[1, 2].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-3xl bg-muted/60" />
      ))}
    </div>
  );
}

export function MilestoneTrackerEmpty({
  onCreateClick,
}: {
  onCreateClick?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
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
