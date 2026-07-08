"use client";

import { LazyExplorePinCard } from "@/components/lazy-explore-pin-card";
import { SocialFeedCardSkeleton } from "@/components/delulu-skeleton";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import { cn } from "@/lib/utils";

interface ExploreSocialFeedProps {
  delulus: FormattedDeluluFeed[];
  isLoading?: boolean;
  nowMs?: number;
  creatorPfps: Record<string, string | null | undefined>;
  className?: string;
}

export function ExploreSocialFeed({
  delulus,
  isLoading,
  nowMs,
  creatorPfps,
  className,
}: ExploreSocialFeedProps) {
  // Subgraph returns createdAt desc; keep that order (newest first).
  const feedItems = delulus;

  const masonryClass = cn(
    "w-full columns-1 gap-x-5 sm:columns-2 lg:columns-3",
    className,
  );

  if (isLoading) {
    return (
      <div className={masonryClass}>
        {Array.from({ length: 9 }).map((_, i) => (
          <SocialFeedCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (feedItems.length === 0) return null;

  return (
    <div className={masonryClass}>
      {feedItems.map((delusion, index) => {
        return (
          <LazyExplorePinCard
            key={`social-${delusion.onChainId || delusion.id}-${index}`}
            delusion={delusion}
            href={`/delulu/${delusion.id}`}
            className="w-full"
            nowMs={nowMs}
            imagePriority={index < 6}
            creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
            feedMilestones={delusion.feedMilestones}
            totalMilestoneCount={delusion.totalMilestoneCount}
          />
        );
      })}
    </div>
  );
}
