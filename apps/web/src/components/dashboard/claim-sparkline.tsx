"use client";

import { cn } from "@/lib/utils";

export function ClaimSparkline({
  data,
  className,
  height = 28,
}: {
  data: number[];
  className?: string;
  height?: number;
}) {
  const width = 80;
  const max = Math.max(1, ...data);
  const points = data
    .map((v, i) => {
      const x = data.length <= 1 ? width / 2 : (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-delulu-blue", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
