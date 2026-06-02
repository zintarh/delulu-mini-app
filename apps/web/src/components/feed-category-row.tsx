"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { LazyDeluluCard } from "@/components/lazy-delulu-card";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import type { FeedCategory } from "@/lib/feed-categories";
import type { FormattedDelulu } from "@/lib/types";
import { FEED_CARD_SLOT_CLASS } from "@/components/feed-card-layout";
import { cn } from "@/lib/utils";

interface FeedCategoryRowProps {
  category: FeedCategory;
  isLoading?: boolean;
  nowMs?: number;
  creatorPfps: Record<string, string | null | undefined>;
  skeletonCount?: number;
}

export function FeedCategoryRow({
  category,
  isLoading,
  nowMs,
  creatorPfps,
  skeletonCount = 3,
}: FeedCategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const showSkeletons = isLoading && category.items.length === 0;

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 12);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 12);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    return () => ro.disconnect();
  }, [category.items.length, updateScrollHints]);

  if (!showSkeletons && category.items.length === 0) {
    return null;
  }

  const showSeeMore =
    !showSkeletons && category.items.length > 0 && category.seeMoreHref;

  return (
    <section
      className="group/row"
      aria-labelledby={`feed-${category.id}`}
    >
      <h2
        id={`feed-${category.id}`}
        className="mb-5 text-center text-xl font-bold tracking-tight text-foreground sm:mb-6 sm:text-2xl lg:text-left"
      >
        {category.title}
      </h2>

      <div className="relative">
        {canScrollLeft ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background via-background/80 to-transparent sm:w-14"
            aria-hidden
          />
        ) : null}
        {canScrollRight ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background via-background/80 to-transparent sm:w-14"
            aria-hidden
          />
        ) : null}

        <div
          ref={scrollRef}
          onScroll={updateScrollHints}
          className={cn(
            "-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1",
            "scrollbar-hide overscroll-x-contain",
          )}
          role="region"
          aria-label={`${category.title} — scroll sideways for more`}
        >
          <div className="flex gap-4 sm:gap-5">
            {showSkeletons
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div
                    key={`skel-${category.id}-${i}`}
                    className={FEED_CARD_SLOT_CLASS}
                  >
                    <DeluluCardSkeleton
                      className="mb-0"
                      forYou={category.id === "for-you"}
                    />
                  </div>
                ))
              : category.items.map((delusion, index) => (
                  <FeedCategoryCard
                    key={`${category.id}-${delusion.onChainId || delusion.id}-${index}`}
                    delusion={delusion}
                    categoryId={category.id}
                    nowMs={nowMs}
                    creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                  />
                ))}
          </div>
        </div>
      </div>

      {showSeeMore ? (
        <div className="mt-6 flex justify-center sm:mt-7">
          <Link
            href={category.seeMoreHref}
            className={cn(
              "inline-flex min-h-[44px] items-center justify-center rounded-full",
              "bg-[#efefef] px-6 py-2.5 text-sm font-semibold text-foreground",
              "transition-colors hover:bg-[#e2e2e2] active:scale-[0.98]",
            )}
          >
            See more
          </Link>
        </div>
      ) : showSkeletons ? (
        <div className="mt-6 flex justify-center sm:mt-7">
          <div className="h-11 w-28 animate-pulse rounded-full bg-[#efefef]" />
        </div>
      ) : null}
    </section>
  );
}

function FeedCategoryCard({
  delusion,
  categoryId,
  nowMs,
  creatorPfpUrl,
}: {
  delusion: FormattedDelulu;
  categoryId: FeedCategory["id"];
  nowMs?: number;
  creatorPfpUrl?: string | null;
}) {
  const feedDelusion = delusion as FormattedDeluluFeed;
  const isForYou = categoryId === "for-you";

  return (
    <div className={FEED_CARD_SLOT_CLASS}>
      <LazyDeluluCard
        delusion={delusion}
        href={`/delulu/${delusion.id}`}
        variant={isForYou ? "feed-for-you" : "feed"}
        className="mb-0 h-full"
        nowMs={nowMs}
        disableMilestoneQuery
        disableUsernameLookup
        feedMilestones={feedDelusion.feedMilestones}
        totalMilestoneCount={feedDelusion.totalMilestoneCount}
        creatorPfpUrl={creatorPfpUrl}
      />
    </div>
  );
}

export function FeedCategoriesSkeleton() {
  const placeholders: FeedCategory[] = [
    { id: "on-a-roll", title: "On a roll 🔥", seeMoreHref: "/search", items: [] },
    { id: "for-you", title: "For you", seeMoreHref: "/search", items: [] },
    { id: "worth-a-look", title: "Worth a look", seeMoreHref: "/search", items: [] },
  ];

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-14">
      {placeholders.map((cat) => (
        <FeedCategoryRow
          key={cat.id}
          category={cat}
          isLoading
          creatorPfps={{}}
        />
      ))}
    </div>
  );
}
