"use client";

import { useMemo } from "react";
import { LazyDeluluCard } from "@/components/lazy-delulu-card";
import { SocialFeedCardSkeleton } from "@/components/delulu-skeleton";
import { buildFeedCategories } from "@/lib/feed-categories";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import type { FormattedDelulu } from "@/lib/types";
import { cn } from "@/lib/utils";

function orderFeedDelulus(
  delulus: FormattedDelulu[],
  address: string | undefined,
): FormattedDelulu[] {
  const seen = new Set<string>();
  const ordered: FormattedDelulu[] = [];

  for (const category of buildFeedCategories(delulus, address)) {
    for (const item of category.items) {
      const key = String(item.onChainId ?? item.id);
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(item);
    }
  }

  for (const item of delulus) {
    const key = String(item.onChainId ?? item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(item);
  }

  return ordered;
}

interface ExploreSocialFeedProps {
  delulus: FormattedDelulu[];
  isLoading?: boolean;
  nowMs?: number;
  creatorPfps: Record<string, string | null | undefined>;
  address?: string;
  className?: string;
}

export function ExploreSocialFeed({
  delulus,
  isLoading,
  nowMs,
  creatorPfps,
  address,
  className,
}: ExploreSocialFeedProps) {
  const feedItems = useMemo(
    () => orderFeedDelulus(delulus, address),
    [delulus, address],
  );

  if (isLoading) {
    return (
      <div className={cn("mx-auto flex w-full max-w-lg flex-col gap-3", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SocialFeedCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (feedItems.length === 0) return null;

  return (
    <div className={cn("mx-auto flex w-full max-w-lg flex-col gap-3", className)}>
      {feedItems.map((delusion, index) => {
        const feedDelusion = delusion as FormattedDeluluFeed;
        return (
          <LazyDeluluCard
            key={`social-${delusion.onChainId || delusion.id}-${index}`}
            delusion={delusion}
            href={`/delulu/${delusion.id}`}
            variant="social"
            className="mb-0"
            nowMs={nowMs}
            disableMilestoneQuery
            disableUsernameLookup
            feedMilestones={feedDelusion.feedMilestones}
            totalMilestoneCount={feedDelusion.totalMilestoneCount}
            creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
          />
        );
      })}
    </div>
  );
}
