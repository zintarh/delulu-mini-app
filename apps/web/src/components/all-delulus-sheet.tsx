"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { TwitterPostCard } from "./twitter-post-card";
import { EndingSoonCard } from "./ending-soon-card";
import { DeluluCardSkeleton, TwitterPostCardSkeleton } from "./delulu-skeleton";
import { Clock, TrendingUp } from "lucide-react";
import Link from "next/link";

interface AllDelulusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulus: FormattedDelulu[];
  onDeluluClick: (delulu: FormattedDelulu) => void;
  isLoading?: boolean;
}

function isEndingSoon(deadline: Date): boolean {
  const diff = deadline.getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  return hours > 0 && hours <= 2;
}

function getCreatedAt(delulu: FormattedDelulu): Date {
  // Use createdAt from IPFS if available, otherwise estimate from staking deadline
  if (delulu.createdAt) {
    return delulu.createdAt;
  }
  // Fallback: estimate 7 days before staking deadline
  return new Date(delulu.stakingDeadline.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function AllDelulusSheet({
  open,
  onOpenChange,
  delulus,
  onDeluluClick,
  isLoading = false,
}: AllDelulusSheetProps) {
  const mockEndingSoon: FormattedDelulu[] = [
    {
      id: 999,
      creator: "0x1234567890123456789012345678901234567890",
      contentHash: "QmMockHash1",
      content: "I will become a millionaire by next month",
      stakingDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
      resolutionDeadline: new Date(Date.now() + 36 * 60 * 60 * 1000),
      totalBelieverStake: 100,
      totalDoubterStake: 50,
      totalStake: 150,
      outcome: false,
      isResolved: false,
      isCancelled: false,
    },
    {
      id: 998,
      creator: "0x9876543210987654321098765432109876543210",
      contentHash: "QmMockHash2",
      content: "Bitcoin will hit $100k by end of year",
      stakingDeadline: new Date(Date.now() + 18 * 60 * 60 * 1000),
      resolutionDeadline: new Date(Date.now() + 42 * 60 * 60 * 1000),
      totalBelieverStake: 200,
      totalDoubterStake: 75,
      totalStake: 275,
      outcome: false,
      isResolved: false,
      isCancelled: false,
    },
  ];

  const endingSoon = delulus.filter((d) => isEndingSoon(d.stakingDeadline));
  const displayEndingSoon = endingSoon.length > 0 ? endingSoon : mockEndingSoon;
  const allDelulusSorted = [...delulus].sort((a, b) => {
    const aCreated = getCreatedAt(a);
    const bCreated = getCreatedAt(b);
    return aCreated.getTime() - bCreated.getTime();
  });

  const regularDelulus = allDelulusSorted.filter(
    (d) => !isEndingSoon(d.stakingDeadline)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !max-h-screen !h-screen  overflow-y-auto"
      >
        <SheetTitle className="sr-only">Delulus</SheetTitle>

        <div className="max-w-lg text-center mx-auto  pb-8">
          <div className="text-center mb-6">
            <Link
              href="/"
              className="flex  text-center justify-center items-center gap-1"
            >
              <span
                className="text-2xl font-black text-delulu-yellow tracking-tighter"
                style={{ fontFamily: "var(--font-gloria)" }}
              >
                delulus
              </span>
              <span className="w-2 h-2 rounded-full bg-delulu-yellow" />
            </Link>
          </div>

          <div className="h-px bg-white/10 mb-6" />
          {isLoading ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-delulu-yellow/50" />
                <span className="text-xs font-bold text-delulu-yellow/50 uppercase tracking-wider">
                  Ending Soon
                </span>
              </div>
              <div
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide "
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {[1, 2].map((i) => (
                  <div key={i} className="shrink-0 w-[280px] bg-white/5 rounded-2xl p-4 border border-white/10 animate-pulse">
                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : displayEndingSoon.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-delulu-yellow/50" />
                <span className="text-xs font-bold text-delulu-yellow/50 uppercase tracking-wider">
                  Ending Soon
                </span>
              </div>
              <div
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide "
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {displayEndingSoon.map((delulu) => (
                  <EndingSoonCard
                    key={delulu.id}
                    delulu={delulu}
                    onClick={() => onDeluluClick(delulu)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-delulu-yellow/50" />
                <span className="text-xs font-bold text-delulu-yellow/50 uppercase tracking-wider">
                  Ending Soon
                </span>
              </div>
              <div className="text-center py-4">
                <p className="text-white/50 text-xs">No delulus ending soon</p>
              </div>
            </div>
          )}

          <div className="">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-delulu-yellow/50" />
              <span className="text-xs font-bold text-delulu-yellow/50 uppercase tracking-wider">
                Trending
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-3 w-full">
                {[1, 2, 3].map((i) => (
                  <TwitterPostCardSkeleton key={i} className="w-full" />
                ))}
              </div>
            ) : regularDelulus.length > 0 ? (
              <div className="space-y-3 w-full">
                {regularDelulus.map((delulu) => (
                  <TwitterPostCard
                    key={delulu.id}
                    delusion={delulu}
                    onClick={() => onDeluluClick(delulu)}
                    className="w-full"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/60 text-sm mb-2">No delulus yet</p>
                <p className="text-white/40 text-xs">
                  Start by creating your first delulu
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
