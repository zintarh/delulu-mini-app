import { cn } from "@/lib/utils";
import { PIN_CARD_ASPECTS } from "@/lib/pin-card-aspect";

export function SocialFeedCardSkeleton({
  className,
  index = 0,
}: {
  className?: string;
  index?: number;
}) {
  const aspect = PIN_CARD_ASPECTS[index % PIN_CARD_ASPECTS.length];

  return (
    <div className={cn("mb-10 break-inside-avoid animate-pulse", className)}>
      <div className="relative">
        <div
          className={cn(
            "w-full overflow-hidden rounded-[20px] bg-muted",
            aspect,
          )}
        />
        <div className="absolute right-3 top-3 h-8 w-16 rounded-full bg-muted-foreground/15" />
      </div>
      <div className="space-y-2.5 px-0.5 pt-3">
        <div className="h-5 w-full rounded bg-muted" />
        <div className="h-5 w-4/5 rounded bg-muted" />
        <div className="flex items-center gap-2.5 pt-0.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Greeting: "Hi, name" + Lulu's one-line status (HomeGreeting). */
function HomeGreetingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-7 w-44 animate-pulse rounded-lg bg-line" />
      <div className="h-4 w-56 animate-pulse rounded bg-line" />
    </div>
  );
}

/** Free daily money card (DailyMoneyCard, green tone). */
function HomeDailyMoneySkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border-2 border-green-line bg-[#f2fbf5] py-3 pl-3.5 pr-3 shadow-edge-green-line">
      <div className="h-[42px] w-[46px] shrink-0 animate-pulse rounded-full bg-green-line/60" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="h-3 w-28 animate-pulse rounded bg-green-line/60" />
        <div className="h-7 w-24 animate-pulse rounded-md bg-green-line/60" />
        <div className="h-3 w-32 animate-pulse rounded bg-green-line/60" />
      </div>
      <div className="h-10 w-20 shrink-0 animate-pulse rounded-2xl bg-green-line/60" />
    </div>
  );
}

/** Daily goal card: title + count, progress bar, hint, Lulu scene (DailyGoalCardView). */
function HomeDailyGoalSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-line" />
          <div className="h-3 w-8 animate-pulse rounded bg-line" />
        </div>
        <div className="mt-2.5 h-2.5 w-full animate-pulse rounded-full bg-line" />
        <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-line" />
      </div>
      <div className="h-[84px] w-[76px] shrink-0 animate-pulse rounded-2xl bg-line" />
    </div>
  );
}

/** "Today's quests" label + quest rows (ForfeitDayCard). */
function HomeQuestsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-2.5 h-3 w-28 animate-pulse rounded bg-line" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[20px] border-2 border-line bg-white p-3 shadow-edge">
            <div className="h-[50px] w-[50px] shrink-0 animate-pulse rounded-2xl bg-line" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-line" />
            </div>
            <div className="h-9 w-16 shrink-0 animate-pulse rounded-full bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading placeholder for the logged-out home screen — mirrors HomeDashboard's guest layout. */
export function HomeGuestSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col gap-4 px-5 pb-6 pt-2.5", className)}
      role="status"
      aria-label="Loading"
    >
      <HomeGreetingSkeleton />
      <HomeQuestsSkeleton rows={1} />
    </div>
  );
}

/** Loading placeholder for the signed-in home dashboard — mirrors HomeDashboard's layout. */
export function HomeSignedInSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col gap-4 px-5 pb-6 pt-2.5", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <HomeGreetingSkeleton />
      <HomeDailyMoneySkeleton />
      <HomeDailyGoalSkeleton />
      <div className="mt-2">
        <HomeQuestsSkeleton />
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
