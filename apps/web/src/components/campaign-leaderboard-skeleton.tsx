"use client";

interface CampaignLeaderboardSkeletonProps {
  rows?: number;
}

export function CampaignLeaderboardSkeleton({
  rows = 4,
}: CampaignLeaderboardSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border p-2 sm:p-3 animate-pulse"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-6 h-4 bg-muted rounded" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-2.5 bg-muted rounded w-2/3" />
            </div>
            <div className="w-10 h-4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

