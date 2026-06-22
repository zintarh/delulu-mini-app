"use client";

import { cn } from "@/lib/utils";

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
  height = 160,
}: {
  data: ChartDatum[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(48, Math.floor(280 / Math.max(data.length, 1)));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${data.length * (barWidth + 12) + 8} ${height + 28}`}
        className="w-full min-w-[280px]"
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const barH = (d.value / max) * (height - 8);
          const x = i * (barWidth + 12) + 4;
          const y = height - barH;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={6}
                fill={d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                opacity={0.9}
              />
              {d.value > 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-semibold"
                  style={{ fontSize: 10 }}
                >
                  {d.value}
                </text>
              ) : null}
              <text
                x={x + barWidth / 2}
                y={height + 18}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DashboardDonutChart({
  data,
  size = 140,
}: {
  data: ChartDatum[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const stroke = size * 0.14;

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

  let offset = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const pct = d.value / total;
      const dash = pct * 2 * Math.PI * r;
      const gap = 2 * Math.PI * r;
      const segment = {
        ...d,
        dasharray: `${dash} ${gap}`,
        dashoffset: -offset,
        color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      };
      offset += dash;
      return segment;
    });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <svg width={size} height={size} className="shrink-0" role="img" aria-label="Donut chart">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0eb" strokeWidth={stroke} />
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="round"
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-foreground font-bold"
          style={{ fontSize: 18 }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9 }}
        >
          total
        </text>
      </svg>
      <ul className="flex flex-1 flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
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

export function DashboardHorizontalBars({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f0f0eb]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
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
  const max = Math.max(...data, 1);
  const width = 120;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="opacity-80" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
