import { cn } from "@/lib/utils";

export function HotDeluluSkeleton() {
  return (
    <div className="relative h-[200px] w-full shrink-0 overflow-hidden rounded-3xl bg-muted p-5">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-full rounded bg-black/20" />
        <div className="h-9 w-full rounded-full bg-black/20" />
      </div>
    </div>
  );
}

export function DeluluCardSkeleton({
  className = "",
  compact = false,
  forYou = false,
}: {
  className?: string;
  index?: number;
  /** Shorter card for profile / grid layouts */
  compact?: boolean;
  /** Matches For you feed row card shape */
  forYou?: boolean;
}) {
  if (forYou) {
    return (
      <div className={cn("mb-0 block h-auto", className)}>
        <div className="relative aspect-[5/4] w-full animate-pulse overflow-hidden rounded-3xl bg-muted shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)]">
          <div className="absolute right-3 top-3 h-9 w-9 rounded-full bg-muted-foreground/20" />
          <div className="absolute inset-x-0 bottom-0 space-y-2 px-3 pb-3">
            <div className="h-4 w-full rounded bg-muted-foreground/25" />
            <div className="h-3 w-4/5 rounded bg-muted-foreground/20" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted-foreground/25" />
              <div className="h-3 flex-1 rounded bg-muted-foreground/20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-4 block h-auto",
        compact ? "min-h-0" : "min-h-[380px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex animate-pulse flex-col overflow-hidden bg-card",
          compact
            ? "min-h-0 rounded-2xl border border-border/60 shadow-sm"
            : "min-h-[380px] rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)]",
        )}
      >
        <div
          className={cn(
            "relative w-full bg-muted",
            compact ? "aspect-[4/3]" : "aspect-[5/4] sm:min-h-[200px]",
          )}
        >
          <div className="absolute bottom-3 right-3 h-9 w-16 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="space-y-2">
            <div className="h-6 w-full rounded bg-muted" />
            <div className="h-5 w-4/5 rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-3 w-10 rounded bg-muted" />
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-5 w-16 rounded bg-muted" />
          </div>
          <div className="flex gap-5">
            <div className="h-4 w-10 rounded bg-muted" />
            <div className="h-4 w-10 rounded bg-muted" />
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-4">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
