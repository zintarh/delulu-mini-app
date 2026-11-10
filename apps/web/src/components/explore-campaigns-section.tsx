"use client";

import { useEffect, useMemo } from "react";
import { Lulu } from "@/components/ds";
import {
  CampaignBannerCard,
  CampaignBannerCardSkeleton,
  campaignDaysLeft,
  isCampaignOpen,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";
import { CAMPAIGN_CATEGORIES, OTHER_CATEGORY, campaignCategoryFor } from "@/lib/community/campaign-category";
import { cn } from "@/lib/utils";

/** Finished campaigns shown at the bottom — the most recent few, not the whole archive. */
const FINISHED_LIMIT = 6;

type Section = { key: string; label: string; campaigns: CampaignExploreCardData[] };

/** One category: a big heading, then a swipe row on phones / a 2-up grid from tablet. */
function CategoryRow({ section }: { section: Section }) {
  const single = section.campaigns.length === 1;
  return (
    <section className="animate-rise">
      <h2 className="m-0 mb-3 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{section.label}</h2>
      <div
        className={cn(
          single
            ? "sm:grid sm:grid-cols-2 sm:gap-4"
            : // Bleed to the screen edges so the next card peeks in and reads as swipeable.
              "scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0",
        )}
      >
        {section.campaigns.map((c) => (
          <CampaignBannerCard
            key={c.id}
            campaign={c}
            className={single ? "w-full" : "w-[86%] shrink-0 snap-start sm:w-full"}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Explore: campaigns grouped by category (Workout, Reading, …) as big photo
 * cards, then recently finished ones. Categories come from each campaign's
 * title/description (lib/community/campaign-category.ts); empty ones are hidden.
 */
export function ExploreCampaignsSection({ address }: { address?: string }) {
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, error, refetch, isRefetching } =
    useExploreCampaigns(address, "recent", {});

  // Grouping needs the whole list (it's small) — otherwise categories reshuffle as pages land.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const campaigns = useMemo(() => data?.pages.flatMap((page) => page.campaigns) ?? [], [data]);

  const sections = useMemo<Section[]>(() => {
    const open = campaigns.filter(isCampaignOpen);
    const byKey = new Map<string, CampaignExploreCardData[]>();
    for (const c of open) {
      const { key } = campaignCategoryFor(c.title, c.description);
      byKey.set(key, [...(byKey.get(key) ?? []), c]);
    }
    // Within a category: yours first, then the ones ending soonest.
    const order = (list: CampaignExploreCardData[]) =>
      [...list].sort(
        (a, b) =>
          Number(b.isJoined) - Number(a.isJoined) ||
          (campaignDaysLeft(a) ?? 1e9) - (campaignDaysLeft(b) ?? 1e9),
      );
    const result: Section[] = [...CAMPAIGN_CATEGORIES, OTHER_CATEGORY]
      .filter((cat) => byKey.has(cat.key))
      .map((cat) => ({ key: cat.key, label: cat.label, campaigns: order(byKey.get(cat.key)!) }));

    const finished = campaigns.filter((c) => !isCampaignOpen(c)).slice(0, FINISHED_LIMIT);
    if (finished.length > 0) result.push({ key: "finished", label: "Finished", campaigns: finished });
    return result;
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="mb-3 h-7 w-40 animate-pulse rounded-lg bg-ink/10" />
            <div className="-mx-5 flex gap-3 overflow-hidden px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0">
              <CampaignBannerCardSkeleton className="w-[86%] shrink-0 sm:w-full" />
              <CampaignBannerCardSkeleton className="w-[86%] shrink-0 sm:w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load campaigns. Try again.</p>
        <button type="button" onClick={() => void refetch()} disabled={isRefetching} className="text-sm font-bold text-ink underline">
          {isRefetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <Lulu size={64} mood="dream" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">No campaigns right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {sections.map((section) => (
        <CategoryRow key={section.key} section={section} />
      ))}
    </div>
  );
}
