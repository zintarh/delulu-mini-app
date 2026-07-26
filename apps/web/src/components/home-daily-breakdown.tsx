"use client";

import { useMemo } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfWeekMonday,
  toIsoDateLocal,
  useDailyActivity,
} from "@/hooks/use-daily-activity";
import { cn } from "@/lib/utils";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const BAR_ACTIVE = "#2563eb";
const BAR_MUTED = "rgba(37, 99, 235, 0.18)";
const BAR_TODAY = "#1d4ed8";
const GRID = "rgba(26, 26, 25, 0.06)";
const TICK = "#8a8a82";

type DayPoint = { date: string; label: string; count: number };

function createBarGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number },
  solid: string,
) {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, solid);
  gradient.addColorStop(1, `${solid}99`);
  return gradient;
}

function DailyBreakdownBarChart({
  days,
  todayIso,
}: {
  days: DayPoint[];
  todayIso: string | null;
}) {
  const max = Math.max(0, ...days.map((d) => d.count));
  // Default scale is 0 → 1 (ticks 0 / 0.5 / 1). Grow only when a day exceeds 1.
  const suggestedMax = Math.max(1, max);
  const stepSize = suggestedMax <= 1 ? 0.5 : 1;

  const chartData: ChartData<"bar"> = useMemo(
    () => ({
      labels: days.map((d) => d.label),
      datasets: [
        {
          label: "Submissions",
          data: days.map((d) => d.count),
          borderRadius: { topLeft: 8, topRight: 8, bottomLeft: 4, bottomRight: 4 },
          borderSkipped: false,
          maxBarThickness: 28,
          categoryPercentage: 0.72,
          barPercentage: 0.88,
          backgroundColor: (ctx: ScriptableContext<"bar">) => {
            const index = ctx.dataIndex;
            const day = days[index];
            const value = day?.count ?? 0;
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea || !day) return BAR_MUTED;
            if (value <= 0) return BAR_MUTED;
            const solid = todayIso && day.date === todayIso ? BAR_TODAY : BAR_ACTIVE;
            return createBarGradient(c, chartArea, solid);
          },
        },
      ],
    }),
    [days, todayIso],
  );

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 550,
        easing: "easeOutQuart",
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: "#1a1a19",
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.85)",
          titleFont: { size: 11, weight: "bold" },
          bodyFont: { size: 12, weight: "bold" },
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          caretSize: 5,
          callbacks: {
            title: (items) => {
              const i = items[0]?.dataIndex ?? 0;
              const day = days[i];
              if (!day) return "";
              const [, m, d] = day.date.split("-");
              return `${day.label} · ${Number(m)}/${Number(d)}`;
            },
            label: (item) => {
              const n = Number(item.raw ?? 0);
              return n === 1 ? "1 submission" : `${n} submissions`;
            },
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: TICK,
            font: { size: 11, weight: 600 },
            padding: 6,
          },
        },
        y: {
          beginAtZero: true,
          max: suggestedMax <= 1 ? 1 : undefined,
          suggestedMax: suggestedMax <= 1 ? undefined : suggestedMax,
          border: { display: false },
          ticks: {
            stepSize,
            color: TICK,
            font: { size: 10, weight: 500 },
            padding: 8,
            callback: (value) => {
              const n = Number(value);
              if (stepSize < 1) {
                // 0 / 0.5 / 1
                if (n === 0 || n === 0.5 || n === 1) {
                  return n === 0.5 ? "0.5" : String(n);
                }
                return "";
              }
              return Number.isInteger(n) ? String(n) : "";
            },
          },
          grid: {
            color: GRID,
            drawTicks: false,
          },
        },
      },
    }),
    [days, suggestedMax, stepSize],
  );

  return (
    <div className="h-[148px] w-full" role="img" aria-label="Weekly submission bar chart">
      <Bar data={chartData} options={options} />
    </div>
  );
}

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
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
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
  const activeDays = data?.days.filter((d) => d.count > 0).length ?? 0;
  const peak = data ? Math.max(0, ...data.days.map((d) => d.count)) : 0;
  const peakDay = data?.days.find((d) => d.count === peak && peak > 0)?.label ?? "—";
  const avg =
    total > 0 ? (total / 7).toFixed(Number.isInteger(total / 7) ? 0 : 1) : "0";

  return (
    <section className="mb-6 px-4">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-delulu-blue/[0.06] to-transparent"
          />

          <div className="relative px-4 pb-1 pt-3.5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  Daily Breakdown
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">{weekLabel}</p>
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

            {!isError ? (
              <p className="pb-3 pt-1 text-center text-[11px] text-muted-foreground">
                {isLoading
                  ? "Loading submissions…"
                  : total === 0
                    ? "No submissions this week — upload a proof to get on the board"
                    : `${activeDays} active day${activeDays === 1 ? "" : "s"} · proof submissions`}
              </p>
            ) : (
              <div className="pb-3" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
