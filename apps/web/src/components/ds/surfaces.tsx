import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** White card with a 2px border and a solid bottom edge. */
export function GameCard({
  tone = "default",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "yellow" | "blue" | "green" | "pink";
}) {
  const tones = {
    default: "border-line bg-white shadow-edge",
    yellow: "border-yellow-line bg-yellow-soft shadow-edge-yellow-line",
    blue: "border-blue-line bg-blue-soft shadow-edge-blue-line",
    green: "border-green-line bg-[#f2fbf5] shadow-edge-green-line",
    pink: "border-pink-line bg-pink-soft shadow-edge-pink-line",
  } as const;
  return (
    <div className={cn("rounded-[20px] border-2", tones[tone], className)} {...rest}>
      {children}
    </div>
  );
}

/** Small rounded stat pill used in the top HUD (streak, points, alerts). */
export function HudPill({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "relative inline-flex h-[38px] items-center gap-1.5 rounded-xl border-2 border-line bg-white px-[11px] text-[15px] font-extrabold text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

const TINTS = {
  blue: "bg-blue-tint text-blue",
  green: "bg-green-soft text-green-edge",
  orange: "bg-[#ffebdd] text-[#c25e12]",
  pink: "bg-pink-soft text-pink",
  purple: "bg-purple-soft text-purple",
  yellow: "bg-yellow-soft text-[#8a6a00]",
} as const;
export type HabitTint = keyof typeof TINTS;

/** Rounded square icon tile in a habit color. */
export function HabitTile({
  icon: Icon,
  tint = "blue",
  size = 50,
  className,
}: {
  icon: LucideIcon;
  tint?: HabitTint;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_-4px_0_rgba(0,0,0,0.07)]", TINTS[tint], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.2} />
    </span>
  );
}

/** Rubber stamp (KEPT / MISSED / SIGNED…). */
export function Stamp({
  tone = "kept",
  big = false,
  slam = false,
  className,
  children,
}: {
  tone?: "kept" | "lost" | "ink";
  big?: boolean;
  slam?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const color = { kept: "text-green-edge", lost: "text-orange", ink: "text-ink" }[tone];
  return (
    <span
      className={cn(
        "inline-flex -rotate-[9deg] items-center gap-1.5 whitespace-nowrap rounded-lg border-current bg-white font-mono font-semibold uppercase tracking-[0.18em]",
        "shadow-[inset_0_0_0_2px_#fff,inset_0_0_0_3.5px_currentColor]",
        big ? "border-4 px-[18px] py-2.5 text-[22px] rounded-xl" : "border-[2.5px] px-2.5 py-[5px] text-xs",
        slam && "animate-stamp-slam",
        color,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Collectible badge medal. */
export function Medal({
  label,
  bg,
  edge,
  locked = false,
  size = 62,
  className,
}: {
  label?: ReactNode;
  bg?: string;
  edge?: string;
  locked?: boolean;
  size?: number;
  className?: string;
}) {
  if (locked) {
    return (
      <span
        className={cn("flex items-center justify-center rounded-full bg-[#ecece7] text-faint shadow-[0_4px_0_#d6d6cf]", className)}
        style={{ width: size, height: size }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={cn("flex items-center justify-center rounded-full font-display text-xl font-black text-ink", className)}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: `0 4px 0 ${edge}, inset 0 0 0 4px rgba(255,255,255,.4)`,
      }}
    >
      {label}
    </span>
  );
}

/** Ticket with a perforated stub on the right and punched notches. */
export function Ticket({
  stub,
  stubWidth = 72,
  dark = false,
  className,
  children,
}: {
  stub?: ReactNode;
  stubWidth?: number;
  dark?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex rounded-3xl border-2",
        dark ? "border-ink bg-ink text-white shadow-edge-ink" : "border-line bg-white shadow-edge",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {stub && (
        <>
          <div
            className={cn("flex shrink-0 flex-col items-center justify-center gap-2 border-l-2 border-dashed py-4", dark ? "border-ink-3" : "border-line")}
            style={{ width: stubWidth }}
          >
            {stub}
          </div>
          <span className="absolute -top-2.5 h-5 w-5 -translate-x-1/2 rounded-full bg-paper" style={{ left: `calc(100% - ${stubWidth}px)` }} />
          <span className="absolute -bottom-2.5 h-5 w-5 -translate-x-1/2 rounded-full bg-paper" style={{ left: `calc(100% - ${stubWidth}px)` }} />
        </>
      )}
    </div>
  );
}

/** Small uppercase mono label used above sections and stats. */
export function MonoLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("label-mono text-muted-foreground", className)}>{children}</span>;
}
