"use client";

import { LazyDeluluCard } from "@/components/lazy-delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import type { FormattedDelulu } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProfileDeluluGridProps {
  delulus: FormattedDelulu[];
  isLoading?: boolean;
  isFetchingMore?: boolean;
  skeletonCount?: number;
  className?: string;
  emptyState?: React.ReactNode;
}

const GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

export function ProfileDeluluGrid({
  delulus,
  isLoading,
  isFetchingMore,
  skeletonCount = 6,
  className,
  emptyState,
}: ProfileDeluluGridProps) {
  if (isLoading) {
    return (
      <div className={cn(GRID_CLASS, className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <DeluluCardSkeleton key={i} compact className="mb-0" />
        ))}
      </div>
    );
  }

  if (delulus.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className={GRID_CLASS}>
        {delulus.map((delusion, index) => (
          <LazyDeluluCard
            key={`profile-delulu-${delusion.onChainId || delusion.id}-${index}`}
            delusion={delusion}
            href={`/delulu/${delusion.id}`}
            variant="grid"
            className="mb-0 h-full"
          />
        ))}
      </div>
      {isFetchingMore ? (
        <div className={GRID_CLASS}>
          {[1, 2, 3].map((i) => (
            <DeluluCardSkeleton key={`more-${i}`} compact className="mb-0" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
