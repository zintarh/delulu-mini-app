"use client";

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { TwitterPostCard } from "./twitter-post-card";
import { EndingSoonCard } from "./ending-soon-card";
import {  TwitterPostCardSkeleton } from "./delulu-skeleton";
import { Clock, TrendingUp, Search, X } from "lucide-react";
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
  return hours > 0 && hours <= 24;
}

function getCreatedAt(delulu: FormattedDelulu): Date {
  if (delulu.createdAt) {
    return delulu.createdAt;
  }
  return new Date(delulu.stakingDeadline.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function AllDelulusSheet({
  open,
  onOpenChange,
  delulus,
  onDeluluClick,
  isLoading = false,
}: AllDelulusSheetProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const endingSoon = delulus.filter((d) => isEndingSoon(d.stakingDeadline));
  const regularDelulusUnfiltered = useMemo(() => {
    const allDelulusSorted = [...delulus].sort((a, b) => {
      const aCreated = getCreatedAt(a);
      const bCreated = getCreatedAt(b);
      return aCreated.getTime() - bCreated.getTime();
    });
    return allDelulusSorted.filter((d) => !isEndingSoon(d.stakingDeadline));
  }, [delulus]);


  const regularDelulus = useMemo(() => {
    if (!searchQuery.trim()) {
      return regularDelulusUnfiltered;
    }

    const query = searchQuery.toLowerCase().trim();
    return regularDelulusUnfiltered.filter((d) => {
      const content = (d.content || d.contentHash || "").toLowerCase();
      const username = (d.username || "").toLowerCase();
      const creator = d.creator.toLowerCase();

      return (
        content.includes(query) ||
        username.includes(query) ||
        creator.includes(query)
      );
    });
  }, [regularDelulusUnfiltered, searchQuery]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchQuery("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search delulus..."
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/20 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
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
                  <div
                    key={i}
                    className="shrink-0 w-[200px] sm:w-[240px] bg-white/5 rounded-xl p-3 border border-white/10 animate-pulse"
                  >
                    <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                    <div className="h-2 bg-white/10 rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : endingSoon.length > 0 ? (
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
                {endingSoon.map((delulu) => (
                  <EndingSoonCard
                    key={delulu.id}
                    delulu={delulu}
                    onClick={() => onDeluluClick(delulu)}
                  />
                ))}
              </div>
            </div>
          ) : !searchQuery ? (
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
          ) : null}

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
            ) : searchQuery ? (
              <div className="text-center py-12">
                <p className="text-white/60 text-sm mb-2">No delulus found</p>
                <p className="text-white/40 text-xs">
                  Try a different search term
                </p>
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
