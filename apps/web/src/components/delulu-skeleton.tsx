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
        <div className="relative aspect-[3/2] w-full animate-pulse overflow-hidden rounded-2xl bg-muted shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)] sm:aspect-[5/4] sm:rounded-3xl">
          <div className="absolute right-2 top-2 h-8 w-8 rounded-full bg-muted-foreground/20 sm:right-3 sm:top-3 sm:h-9 sm:w-9" />
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 px-2.5 pb-2.5 sm:space-y-2 sm:px-3 sm:pb-3">
            <div className="h-3.5 w-full rounded bg-muted-foreground/25 sm:h-4" />
            <div className="h-3 w-4/5 rounded bg-muted-foreground/20" />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-muted-foreground/25 sm:h-8 sm:w-8" />
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
        "mb-3 block h-auto sm:mb-4",
        compact ? "min-h-0" : "min-h-0 sm:min-h-[340px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex animate-pulse flex-col overflow-hidden bg-card",
          compact
            ? "min-h-0 rounded-2xl border border-border/60 shadow-sm"
            : "min-h-0 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.07)] sm:min-h-[340px] sm:rounded-3xl",
        )}
      >
        <div
          className={cn(
            "relative w-full bg-muted",
            compact
              ? "aspect-[16/9] sm:aspect-[4/3]"
              : "aspect-[16/9] sm:aspect-[5/4] sm:min-h-[180px]",
          )}
        >
          <div className="absolute bottom-2 right-2 h-8 w-14 rounded-full bg-muted-foreground/20 sm:bottom-3 sm:right-3 sm:h-9 sm:w-16" />
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-4 sm:p-5">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="h-4 w-full rounded bg-muted sm:h-6" />
            <div className="h-3.5 w-4/5 rounded bg-muted sm:h-5" />
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between">
              <div className="h-2.5 w-16 rounded bg-muted sm:h-3 sm:w-20" />
              <div className="h-2.5 w-8 rounded bg-muted sm:h-3 sm:w-10" />
            </div>
            <div className="h-2 w-full rounded-full bg-muted sm:h-2.5" />
          </div>
          <div className="flex justify-between">
            <div className="h-3.5 w-20 rounded bg-muted sm:h-4 sm:w-24" />
            <div className="h-4 w-14 rounded bg-muted sm:h-5 sm:w-16" />
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-2.5 sm:gap-2.5 sm:pt-4">
            <div className="h-8 w-8 rounded-full bg-muted sm:h-10 sm:w-10" />
            <div className="h-3.5 w-24 rounded bg-muted sm:h-4 sm:w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
