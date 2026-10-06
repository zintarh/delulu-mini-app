import { cn } from "@/lib/utils";

/** Chunky progress bar with an inner highlight; fills on mount. */
export function ProgressBar({
  value,
  tone = "green",
  thin = false,
  className,
  label,
}: {
  value: number; // 0..1
  tone?: "green" | "yellow" | "blue" | "grey";
  thin?: boolean;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = { green: "bg-green", yellow: "bg-yellow", blue: "bg-[#3d7bf0]", grey: "bg-faint" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("overflow-hidden rounded-full bg-line", thin ? "h-2" : "h-4", className)}
    >
      <span
        className={cn(
          "relative block h-full origin-left animate-bar-fill rounded-full shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)]",
          !thin && "after:absolute after:inset-x-2 after:top-[3px] after:h-1 after:rounded-sm after:bg-white/45",
          fill,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Burning fuse for "time left" with a glowing spark at the end. */
export function Fuse({ value, light = false, spark = true, className }: { value: number; light?: boolean; spark?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("relative h-1 rounded-sm", light ? "bg-line" : "bg-ink-3", className)} aria-hidden>
      <span className={cn("absolute inset-y-0 left-0 rounded-sm", light ? "bg-ink" : "bg-yellow")} style={{ width: `${pct}%` }} />
      {spark ? <span
        className="absolute top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 animate-spark rounded-full bg-yellow shadow-[0_0_0_4px_rgba(246,195,36,.3),0_0_18px_4px_rgba(246,195,36,.55)]"
        style={{ left: `${pct}%` }}
      /> : null}
    </div>
  );
}
