"use client";

import {
  FeedCategoriesSkeleton,
  FeedCategoryRow,
} from "@/components/feed-category-row";
import type { FeedCategory } from "@/lib/feed-categories";
import { cn } from "@/lib/utils";

interface HomeFeedExploreProps {
  categories: FeedCategory[];
  isLoading?: boolean;
  nowMs?: number;
  creatorPfps: Record<string, string | null | undefined>;
  className?: string;
}

export function HomeFeedExplore({
  categories,
  isLoading,
  nowMs,
  creatorPfps,
  className,
}: HomeFeedExploreProps) {
  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <FeedExploreHero />
        <FeedCategoriesSkeleton />
      </div>
    );
  }

  const visible = categories.filter((c) => c.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <FeedExploreHero />
      <div className="space-y-10 sm:space-y-12 lg:space-y-14">
        {visible.map((category) => (
          <FeedCategoryRow
            key={category.id}
            category={category}
            nowMs={nowMs}
            creatorPfps={creatorPfps}
          />
        ))}
      </div>
    </div>
  );
}

function FeedExploreHero() {
  return (
    <header className="mb-5 text-center sm:mb-6 lg:mb-8 lg:text-left">
      <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-4xl sm:leading-tight">
        Explore delulus
      </h1>
    </header>
  );
}
