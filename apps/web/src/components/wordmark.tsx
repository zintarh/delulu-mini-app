import { cn } from "@/lib/utils";

/** Full "delulu" lockup, closed with a colored dot — for places with room for the whole name. */
export function Wordmark({
  size = 20,
  dotColor = "var(--delulu-yellow, #f6c324)",
  className,
}: {
  size?: number;
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Delulu"
      className={cn(
        "inline-flex items-baseline font-extrabold tracking-tight text-foreground",
        className,
      )}
      style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: size }}
    >
      delulu
      <span aria-hidden="true" style={{ color: dotColor }}>.</span>
    </span>
  );
}
