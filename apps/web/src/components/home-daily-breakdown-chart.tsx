"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
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

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const BAR_ACTIVE = "#2563eb";
const BAR_MUTED = "rgba(37, 99, 235, 0.18)";
const BAR_TODAY = "#1d4ed8";
// Chart.js draws to a <canvas>, so it needs real color strings, not CSS
// variables — these have to be picked explicitly per theme instead of
// inheriting from globals.css like everything else.
const GRID_LIGHT = "rgba(26, 26, 25, 0.06)";
const GRID_DARK = "rgba(242, 241, 236, 0.1)";
const TICK_LIGHT = "#8a8a82";
const TICK_DARK = "#a3a39c";

export type DailyBreakdownDayPoint = { date: string; label: string; count: number };

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

export function DailyBreakdownBarChart({
  days,
  todayIso,
}: {
  days: DailyBreakdownDayPoint[];
  todayIso: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const GRID = isDark ? GRID_DARK : GRID_LIGHT;
  const TICK = isDark ? TICK_DARK : TICK_LIGHT;

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
    [days, suggestedMax, stepSize, GRID, TICK],
  );

  return (
    <div className="h-[100px] w-full" role="img" aria-label="Weekly submission bar chart">
      <Bar data={chartData} options={options} />
    </div>
  );
}
