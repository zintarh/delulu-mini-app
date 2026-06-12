import { cn } from "@/lib/utils";

const PIN_SKELETON_ASPECTS = [
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-square",
  "aspect-[3/5]",
] as const;

export function SocialFeedCardSkeleton({
  className,
  index = 0,
}: {
  className?: string;
  index?: number;
}) {
  const aspect = PIN_SKELETON_ASPECTS[index % PIN_SKELETON_ASPECTS.length];

  return (
    <div className={cn("mb-8 break-inside-avoid animate-pulse", className)}>
      <div className="relative">
        <div
          className={cn(
            "w-full overflow-hidden rounded-[20px] bg-muted",
            aspect,
            "md:aspect-[5/4] md:max-h-[200px] lg:max-h-[220px]",
          )}
        />
        <div className="absolute right-3 top-3 h-8 w-16 rounded-full bg-muted-foreground/15" />
      </div>
      <div className="space-y-2 px-0.5 pt-2.5">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
        <div className="flex items-center gap-2 pt-0.5">
          <div className="h-7 w-7 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-2.5 w-14 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Loading placeholder for the logged-out home screen. */
export function HomeGuestSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-2xl px-4 py-10 text-center xl:max-w-3xl lg:py-14",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <div className="animate-pulse rounded-2xl border border-border/40 bg-muted/30 px-3.5 py-3">
        <div className="flex gap-3">
          <div className="h-8 w-8 shrink-0 rounded-xl bg-muted" />
          <div className="min-w-0 flex-1 space-y-2 text-left">
            <div className="h-2.5 w-24 rounded bg-muted" />
            <div className="h-3.5 w-full rounded bg-muted" />
            <div className="h-3.5 w-[85%] rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="mx-auto mt-3 max-w-sm space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mx-auto h-4 w-[90%] animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <div className="h-12 w-full animate-pulse rounded-full bg-muted sm:w-32" />
        <div className="h-12 w-full animate-pulse rounded-full bg-muted/70 sm:w-44" />
      </div>
    </div>
  );
}

/** Loading placeholder for the signed-in home dashboard while auth restores. */
export function HomeSignedInSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto w-full max-w-2xl xl:max-w-3xl", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <header className="px-4 pt-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-7 w-44 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-[4.25rem] w-24 shrink-0 animate-pulse rounded-2xl bg-muted" />
        </div>
      </header>
      <div className="mb-4 mt-3 space-y-2.5 px-4">
        <div className="h-[4.25rem] animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
      </div>
      <div className="space-y-3 px-4 pb-4">
        <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      </div>
    </div>
  );
}

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
