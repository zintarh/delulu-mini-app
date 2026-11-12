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
      <div className="h-[34px] w-52 animate-pulse rounded-lg bg-ink/10" />
      <div className="h-4 w-56 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

/** Section heading at SectionHeading's size (20px). */
function HomeSectionHeadingSkeleton({ width = "w-40" }: { width?: string }) {
  return <div className={cn("mb-4 h-6 animate-pulse rounded-lg bg-ink/10", width)} />;
}

/** Lulu hero (LuluHero): Lulu in her ring + a speech bubble, stats row underneath. */
function HomeLuluSkeleton() {
  return (
    <div className="rounded-[28px] border-2 border-line bg-yellow-soft/70 p-5 shadow-edge">
      <div className="flex items-center gap-4">
        <div className="h-[120px] w-[120px] shrink-0 animate-pulse rounded-full bg-white/70" />
        <div className="flex-1 space-y-2 rounded-2xl bg-white/80 p-3.5">
          <div className="h-4 w-full animate-pulse rounded bg-line" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-line" />
          <div className="mt-3 h-10 w-24 animate-pulse rounded-xl bg-line" />
        </div>
      </div>
      <div className="mt-4 h-6 w-24 animate-pulse rounded-full bg-white/70" />
    </div>
  );
}

/** Wide campaign cards (CampaignBannerCard) in their swipe row / 2-up grid. */
function HomeCampaignsSkeleton() {
  return (
    <div>
      <HomeSectionHeadingSkeleton width="w-56" />
      <div className="-mx-5 flex gap-3 overflow-hidden px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-0">
        {[0, 1].map((i) => (
          <div key={i} className="aspect-[16/11] min-h-[264px] w-[86%] shrink-0 animate-pulse rounded-[32px] bg-ink/10 sm:w-full" />
        ))}
      </div>
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
export function HomeDailyGoalSkeleton() {
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
      <HomeSectionHeadingSkeleton />
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
      className={cn("mx-auto flex w-full flex-col gap-10 px-5 pb-10 pt-3", className)}
      role="status"
      aria-label="Loading"
    >
      <HomeGreetingSkeleton />
      {/* "New here? Create your first delulu" row */}
      <div className="h-[66px] w-full animate-pulse rounded-[20px] bg-line" />
      <HomeCampaignsSkeleton />
    </div>
  );
}

/** Loading placeholder for the signed-in home dashboard — mirrors HomeDashboard's layout. */
export function HomeSignedInSkeleton({ className }: { className?: string }) {
  return (
    // Same container, gaps and blocks as HomeDashboard, so the swap to real content doesn't shift.
    <div
      className={cn("mx-auto flex w-full flex-col gap-10 px-5 pb-10 pt-3", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <HomeGreetingSkeleton />
      <div className="flex flex-col gap-4">
        <HomeLuluSkeleton />
        <HomeDailyMoneySkeleton />
      </div>
      <HomeQuestsSkeleton />
      <HomeCampaignsSkeleton />
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
