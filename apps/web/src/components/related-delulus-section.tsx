"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LazyDeluluCard } from "@/components/lazy-delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { FEED_CARD_SLOT_CLASS } from "@/components/feed-card-layout";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import { usePfps } from "@/hooks/use-profile-pfp";

const EXPLORE_LIMIT = 3;

function isContentLoaded(d: FormattedDelulu): boolean {
  if (!d.content) return false;
  const isHash =
    d.content.startsWith("Qm") ||
    (d.content.length > 40 && /^[a-f0-9]+$/i.test(d.content));
  return !isHash;
}

interface RelatedDelulusSectionProps {
  excludeId: number;
  creatorAddress?: string;
}

export function RelatedDelulusSection({
  excludeId,
  creatorAddress,
}: RelatedDelulusSectionProps) {
  const { delulus, isLoading } = useAllDelulus();

  const related = useMemo(() => {
    const pool = delulus.filter(
      (d) => d.id !== excludeId && isContentLoaded(d),
    );
    const creator = creatorAddress?.toLowerCase();
    const byCreator = creator
      ? pool.filter((d) => d.creator.toLowerCase() === creator)
      : [];
    const others = creator
      ? pool.filter((d) => d.creator.toLowerCase() !== creator)
      : pool;
    return [...byCreator, ...others].slice(0, EXPLORE_LIMIT);
  }, [delulus, excludeId, creatorAddress]);

  const creatorAddresses = useMemo(
    () => Array.from(new Set(related.map((d) => d.creator.toLowerCase()))),
    [related],
  );
  const creatorPfps = usePfps(creatorAddresses);

  if (!isLoading && related.length === 0) return null;

  return (
    <section
      className="mt-4 sm:mt-5 lg:mt-8"
      aria-labelledby="explore-more-heading"
    >
      <h2
        id="explore-more-heading"
        className="mb-5 text-center text-xl font-bold tracking-tight text-foreground sm:mb-6 sm:text-2xl lg:text-left"
      >
        Explore more
      </h2>

      <div
        className="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1 scrollbar-hide overscroll-x-contain lg:overflow-visible"
        role="region"
        aria-label="More delulus to explore"
      >
        <div className="flex gap-4 sm:gap-5">
          {isLoading
            ? Array.from({ length: EXPLORE_LIMIT }).map((_, i) => (
                <div key={i} className={FEED_CARD_SLOT_CLASS}>
                  <DeluluCardSkeleton className="mb-0" />
                </div>
              ))
            : related.map((delusion, index) => {
                const feedDelusion = delusion as FormattedDeluluFeed;
                return (
                  <div
                    key={`explore-more-${delusion.onChainId || delusion.id}-${index}`}
                    className={FEED_CARD_SLOT_CLASS}
                  >
                    <LazyDeluluCard
                      delusion={delusion}
                      href={`/delulu/${delusion.id}`}
                      variant="feed"
                      className="mb-0 h-full"
                      disableMilestoneQuery
                      disableUsernameLookup
                      feedMilestones={feedDelusion.feedMilestones}
                      totalMilestoneCount={feedDelusion.totalMilestoneCount}
                      creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                    />
                  </div>
                );
              })}
        </div>
      </div>

      <div className="mt-6 flex justify-center sm:mt-7 lg:justify-start">
        <Link
          href="/explore"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#efefef] px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-[#e2e2e2] active:scale-[0.98]"
        >
          Explore more
        </Link>
      </div>
    </section>
  );
}
