import { Lulu } from "@/components/ds/art";
import { cn } from "@/lib/utils";

/**
 * Full Delulu lockup: Lulu (the mascot mark) + the Fredoka "delulu" wordmark.
 * `size` is the wordmark font size; the mark scales with it.
 */
export function Wordmark({
  size = 20,
  showMark = true,
  className,
}: {
  size?: number;
  showMark?: boolean;
  /** @deprecated kept for older call sites; the new lockup has no dot. */
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Delulu"
      className={cn("inline-flex items-center text-ink", className)}
      style={{ gap: Math.round(size * 0.3) }}
    >
      {showMark && <Lulu size={Math.round(size * 1.5)} />}
      <span
        aria-hidden="true"
        className="font-brand font-bold leading-none tracking-[-0.02em]"
        style={{ fontSize: size }}
      >
        delulu
      </span>
    </span>
  );
}
