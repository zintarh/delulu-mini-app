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
import { useBingoList } from "@/hooks/use-bingo";
import { BingoBannerCard } from "@/components/bingo/bingo-tile";
import { PinBoard, pinAspect } from "@/components/ui/pin-board";
import type { BingoView } from "@/lib/bingo/view";
import { CAMPAIGN_CATEGORIES, OTHER_CATEGORY, campaignCategoryFor } from "@/lib/community/campaign-category";
import { cn } from "@/lib/utils";

/** Finished campaigns shown at the bottom — the most recent few, not the whole archive. */
const FINISHED_LIMIT = 6;

type Section = { key: string; label: string; campaigns: CampaignExploreCardData[] };

/** One category: a big heading, then a Pinterest-style board of its missions. */
function CategoryRow({ section }: { section: Section }) {
  return (
    <section className="animate-rise">
      <h2 className="m-0 mb-3 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink night:text-white">{section.label}</h2>
      <PinBoard>
        {section.campaigns.map((c, i) => (
          <CampaignBannerCard key={c.id} campaign={c} pin={pinAspect(i)} />
        ))}
      </PinBoard>
    </section>
  );
}

/** Bingos sit with campaigns on their own board: yours first, then ones you can join. */
function BingoRow({ bingos }: { bingos: BingoView[] }) {
  return (
    <section className="animate-rise">
      <h2 className="m-0 mb-3 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink night:text-white">Bingo</h2>
      <PinBoard>
        {bingos.map((b, i) => (
          <BingoBannerCard key={b.id} bingo={b} pin={pinAspect(i + 1)} />
        ))}
      </PinBoard>
    </section>
  );
}

const bingoRank = (b: BingoView) =>
  b.me && b.me.status === "active" && b.me.phase !== "ended" ? 0 : b.joinable ? 1 : b.cycle?.phase === "upcoming" ? 2 : 3;

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
  const { bingos: bingoList } = useBingoList();
  const bingos = useMemo(
    () =>
      [...(bingoList ?? [])]
        .filter((b) => b.joinable || b.me || b.enrollment === "rolling" || b.cycle?.phase === "live" || b.cycle?.phase === "upcoming")
        .sort((a, b) => bingoRank(a) - bingoRank(b)),
    [bingoList],
  );

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
            <PinBoard>
              {[0, 1, 2, 3].map((k) => (
                <CampaignBannerCardSkeleton key={k} pin={pinAspect(k)} />
              ))}
            </PinBoard>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load missions. Try again.</p>
        <button type="button" onClick={() => void refetch()} disabled={isRefetching} className="text-sm font-bold text-ink underline night:text-white">
          {isRefetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (sections.length === 0 && bingos.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <Lulu size={64} mood="dream" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">No missions right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {bingos.length > 0 ? <BingoRow bingos={bingos} /> : null}
      {sections.map((section) => (
        <CategoryRow key={section.key} section={section} />
      ))}
    </div>
  );
}
