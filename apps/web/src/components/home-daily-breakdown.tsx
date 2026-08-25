"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  startOfWeekMonday,
  toIsoDateLocal,
  useDailyActivity,
} from "@/hooks/use-daily-activity";
import { cn } from "@/lib/utils";
import { FEED_CARD_EYEBROW_CLASS } from "@/components/feed-card-layout";

/** Chart.js is heavy — load only when the breakdown has data to show. */
const DailyBreakdownBarChart = dynamic(
  () =>
    import("@/components/home-daily-breakdown-chart").then((m) => m.DailyBreakdownBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100px] items-end gap-2.5 px-1 pb-3 pt-2">
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
  href,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  /** Renders the pill as a link instead of a static div — used for the points pill. */
  href?: string;
  icon?: React.ReactNode;
}) {
  const pillClassName = cn(
    "min-w-0 flex-1 rounded-xl px-2 py-1.5",
    accent ? "bg-delulu-blue/10" : "bg-muted/70",
    href && "transition-opacity active:opacity-70",
  );
  const content = (
    <>
      <p className="flex items-center gap-1 text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-black tabular-nums leading-none",
          accent ? "text-delulu-blue" : "text-foreground",
        )}
      >
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={pillClassName}>
        {content}
      </Link>
    );
  }
  return <div className={pillClassName}>{content}</div>;
}

export function HomeDailyBreakdown({
  address,
  points,
  pointsLoading,
}: {
  address: string;
  /** Rewards points — folded in here as a 4th stat instead of a standalone
   *  header pill, since this is where "your numbers" content already lives. */
  points?: number;
  pointsLoading?: boolean;
}) {
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
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-delulu-blue-light/60 to-white shadow-sm dark:from-delulu-blue/10 dark:to-card">
        <div className="relative">
          <div className="relative px-3.5 pb-2.5 pt-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={FEED_CARD_EYEBROW_CLASS}>
                  Daily Breakdown
                </p>
                <p className="mt-0.5 truncate text-xs font-bold text-foreground">
                  {weekLabel}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-background/80 p-0.5 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={goPrevWeek}
                  aria-label="Previous week"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={goNextWeek}
                  disabled={!canGoForward}
                  aria-label="Next week"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="mb-2 flex gap-1.5">
              <StatPill label="Total" value={isLoading ? "—" : String(total)} accent />
              <StatPill label="Avg / day" value={isLoading ? "—" : avg} />
              <StatPill
                label="Best day"
                value={isLoading ? "—" : peak > 0 ? `${peakDay} · ${peak}` : "—"}
              />
              {points != null ? (
                <StatPill
                  label="Points"
                  value={pointsLoading ? "—" : points.toLocaleString()}
                  href="/rewards"
                  icon={<Star className="h-2.5 w-2.5 fill-delulu-blue text-delulu-blue" />}
                />
              ) : null}
            </div>

            {isLoading ? (
              <div className="flex h-[100px] items-end gap-2.5 px-1 pb-3 pt-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 animate-pulse rounded-t-lg bg-muted"
                    style={{ height: `${36 + ((i * 23) % 90)}%` }}
                  />
                ))}
              </div>
            ) : isError ? (
              <div className="flex h-[100px] items-center justify-center px-4 text-center">
                <p className="text-xs text-muted-foreground">
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
