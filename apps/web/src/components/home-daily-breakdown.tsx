"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfWeekMonday,
  toIsoDateLocal,
  useDailyActivity,
} from "@/hooks/use-daily-activity";
import { cn } from "@/lib/utils";
import {
  FEED_CARD_EYEBROW_CLASS,
  FEED_CARD_SUBTITLE_CLASS,
} from "@/components/feed-card-layout";

/** Chart.js is heavy — load only when the breakdown has data to show. */
const DailyBreakdownBarChart = dynamic(
  () =>
    import("@/components/home-daily-breakdown-chart").then((m) => m.DailyBreakdownBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[148px] items-end gap-3 px-1 pb-5 pt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t-lg bg-muted"
            style={{ height: `${36 + ((i * 23) % 90)}%` }}
          />
        ))}
      </div>
    ),
  },
);

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-xl px-2.5 py-2",
        accent ? "bg-delulu-blue/10" : "bg-muted/70",
      )}
    >
      <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-base font-black tabular-nums leading-none",
          accent ? "text-delulu-blue" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function HomeDailyBreakdown({ address }: { address: string }) {
  const {
    weekStart,
    weekLabel,
    canGoForward,
    goPrevWeek,
    goNextWeek,
    data,
    isLoading,
    isError,
  } = useDailyActivity(address);

  const todayIso = toIsoDateLocal(new Date());
  const currentWeekStart = toIsoDateLocal(startOfWeekMonday(new Date()));
  const highlightToday = weekStart === currentWeekStart ? todayIso : null;

  const total = data?.total ?? 0;
  const peak = data ? Math.max(0, ...data.days.map((d) => d.count)) : 0;
  const peakDay = data?.days.find((d) => d.count === peak && peak > 0)?.label ?? "—";
  const avg =
    total > 0 ? (total / 7).toFixed(Number.isInteger(total / 7) ? 0 : 1) : "0";

  return (
    <section className="mb-6 px-4">
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-b from-delulu-blue-light/60 to-card shadow-sm">
        <div className="relative">
          <div className="relative px-4 pb-1 pt-3.5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={FEED_CARD_EYEBROW_CLASS}>
                  Daily Breakdown
                </p>
                <p className={cn("mt-0.5 font-bold text-foreground", FEED_CARD_SUBTITLE_CLASS)}>
                  {weekLabel}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-background/80 p-0.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={goPrevWeek}
                  aria-label="Previous week"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goNextWeek}
                  disabled={!canGoForward}
                  aria-label="Next week"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-3 flex gap-2">
              <StatPill label="Total" value={isLoading ? "—" : String(total)} accent />
              <StatPill label="Avg / day" value={isLoading ? "—" : avg} />
              <StatPill
                label="Best day"
                value={isLoading ? "—" : peak > 0 ? `${peakDay} · ${peak}` : "—"}
              />
            </div>

            {isLoading ? (
              <div className="flex h-[148px] items-end gap-3 px-1 pb-5 pt-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 animate-pulse rounded-t-lg bg-muted"
                    style={{ height: `${36 + ((i * 23) % 90)}%` }}
                  />
                ))}
              </div>
            ) : isError ? (
              <div className="flex h-[148px] items-center justify-center px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t load activity. Try again in a moment.
                </p>
              </div>
            ) : data ? (
              <DailyBreakdownBarChart days={data.days} todayIso={highlightToday} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
