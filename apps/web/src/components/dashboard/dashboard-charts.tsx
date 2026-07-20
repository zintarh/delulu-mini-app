"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { cn } from "@/lib/utils";

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
);

export type ChartDatum = { label: string; value: number; color?: string };

const DEFAULT_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#64748b",
];

function colorFor(d: ChartDatum, i: number) {
  return d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

export function DashboardChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#e8e8e3] bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function DashboardBarChart({
  data,
  height = 200,
}: {
  data: ChartDatum[];
  height?: number;
}) {
  const chartData: ChartData<"bar"> = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: data.map((d, i) => colorFor(d, i)),
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: "#6b7280" },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 }, color: "#6b7280" },
        grid: { color: "#f0f0eb" },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} aria-label="Bar chart" role="img" />
    </div>
  );
}

const centerTextPlugin: Plugin<"doughnut"> = {
  id: "centerText",
  afterDraw(chart) {
    const total = (chart.options.plugins as any)?.centerText?.total;
    if (total == null) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a19";
    ctx.font = "700 18px Inter, sans-serif";
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = "#6b7280";
    ctx.font = "400 9px Inter, sans-serif";
    ctx.fillText("total", cx, cy + 12);
    ctx.restore();
  },
};

export function DashboardDonutChart({
  data,
  size = 140,
}: {
  data: ChartDatum[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="rounded-full border-[10px] border-muted"
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
        <p className="text-xs text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const nonZero = data.filter((d) => d.value > 0);
  const chartData: ChartData<"doughnut"> = {
    labels: nonZero.map((d) => d.label),
    datasets: [
      {
        data: nonZero.map((d) => d.value),
        backgroundColor: nonZero.map((d, i) => colorFor(d, i)),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
      // @ts-expect-error custom plugin option
      centerText: { total },
    },
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div style={{ width: size, height: size }} className="shrink-0">
        <Doughnut data={chartData} options={options} plugins={[centerTextPlugin]} />
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(d, i) }}
              />
              {d.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardHorizontalBars({ data, height }: { data: ChartDatum[]; height?: number }) {
  const chartData: ChartData<"bar"> = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: data.map((d, i) => colorFor(d, i)),
        borderRadius: 6,
        maxBarThickness: 18,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0, font: { size: 10 }, color: "#6b7280" },
        grid: { color: "#f0f0eb" },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: "#1a1a19" },
      },
    },
  };

  return (
    <div style={{ height: height ?? Math.max(120, data.length * 34) }}>
      <Bar data={chartData} options={options} aria-label="Horizontal bar chart" role="img" />
    </div>
  );
}

export function DashboardSparkline({
  data,
  color = "#2563eb",
  height = 48,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return null;

  const chartData: ChartData<"line"> = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: `${color}22`,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: { line: { borderCapStyle: "round" } },
  };

  return (
    <div style={{ width: 120, height }} className="opacity-90">
      <Line data={chartData} options={options} aria-hidden />
    </div>
  );
}
