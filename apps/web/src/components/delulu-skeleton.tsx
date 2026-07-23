import { cn } from "@/lib/utils";
import { PIN_CARD_ASPECTS } from "@/lib/pin-card-aspect";
import { MissionCardSkeleton } from "@/components/community/mission-card";
import { CampaignExploreCardSkeleton } from "@/components/community/campaign-explore-card";

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

/** Placeholder for the feature carousel — mirrors a single full-bleed HomeFeatureCarousel card. */
function HomeFeatureCarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      <div className="h-[168px] w-full shrink-0 animate-pulse rounded-3xl bg-muted sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]" />
      <div className="hidden h-[168px] w-[calc((100%-0.75rem)/2)] shrink-0 animate-pulse rounded-3xl border border-border bg-muted sm:block lg:w-[calc((100%-1.5rem)/3)]" />
      <div className="hidden h-[168px] w-[calc((100%-1.5rem)/3)] shrink-0 animate-pulse rounded-3xl border border-border bg-muted lg:block" />
    </div>
  );
}

/** Placeholder for the Top 10 banner. */
function HomeTop10BannerSkeleton() {
  return <div className="h-[104px] w-full animate-pulse rounded-2xl bg-muted sm:h-[92px]" />;
}

/** Placeholder for the greeting header + points/streak chips. */
function HomeHeaderSkeleton() {
  return (
    <header className="px-4 pt-1">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-7 w-14 animate-pulse rounded-full bg-muted" />
          <div className="h-7 w-14 animate-pulse rounded-full border border-border bg-muted" />
        </div>
      </div>
    </header>
  );
}

/** Loading placeholder for the logged-out home screen — mirrors the actual guest home feed layout. */
export function HomeGuestSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto w-full max-w-4xl xl:max-w-6xl", className)}
      role="status"
      aria-label="Loading"
    >
      <HomeHeaderSkeleton />
      <div className="mb-4 mt-3 px-4">
        <HomeFeatureCarouselSkeleton />
      </div>
      <div className="mb-4 px-4">
        <HomeTop10BannerSkeleton />
      </div>
      <div className="px-4 py-4">
        <div className="mb-3 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CampaignExploreCardSkeleton />
          <CampaignExploreCardSkeleton className="hidden md:flex" />
          <CampaignExploreCardSkeleton className="hidden md:flex" />
        </div>
      </div>
    </div>
  );
}

/** Loading placeholder for the signed-in home dashboard — mirrors the actual home feed layout. */
export function HomeSignedInSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto w-full  max-w-4xl xl:max-w-6xl", className)}
      role="status"
      aria-label="Loading dashboard"
    >
      <HomeHeaderSkeleton />
      <div className="mb-4 mt-3 px-4">
        <HomeFeatureCarouselSkeleton />
      </div>
      <div className="mb-4 px-4">
        <HomeTop10BannerSkeleton />
      </div>
      <div className="px-4 pt-6 pb-2">
        <div className="mb-4 h-3 w-28 animate-pulse rounded bg-muted" />
        <MissionCardSkeleton />
      </div>
      <div className="mt-10" />
      <div className="px-4 py-4">
        <div className="mb-3 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <CampaignExploreCardSkeleton />
          <CampaignExploreCardSkeleton className="hidden lg:flex" />
          <CampaignExploreCardSkeleton className="hidden lg:flex" />
        </div>
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
