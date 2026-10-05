import { cn } from "@/lib/utils";

const COLORS = ["#F6C324", "#2DB36F", "#3D7BF0", "#F28B30", "#EC5B8D", "#8B5CF6", "#161615"];

/** One-shot falling confetti for celebration screens (pure CSS, motion-safe). */
export function ConfettiRain({ count = 26, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute -top-6 animate-confetti-fall rounded-sm"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            width: 8 + (i % 3) * 2,
            height: 15,
            background: COLORS[i % COLORS.length],
            animationDelay: `${((i * 0.07) % 0.9).toFixed(2)}s`,
            animationDuration: `${(2.2 + (i % 5) * 0.25).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

/** A few static, rotated confetti pieces for decoration. */
export function ConfettiStatic({
  pieces,
}: {
  pieces: { left: string; top: string; color: string; rotate: number; w?: number; h?: number }[];
}) {
  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-[3px]"
          style={{ left: p.left, top: p.top, width: p.w ?? 12, height: p.h ?? 18, background: p.color, transform: `rotate(${p.rotate}deg)` }}
        />
      ))}
    </>
  );
}
