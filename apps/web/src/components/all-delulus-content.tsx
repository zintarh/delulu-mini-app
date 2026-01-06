"use client";

import { useState, useMemo } from "react";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { DeluluCard } from "./delulu-card";
import { EndingSoonCard } from "./ending-soon-card";
import { DeluluCardSkeleton } from "./delulu-skeleton";
import { Clock, TrendingUp, Search, X } from "lucide-react";
import Link from "next/link";

interface AllDelulusContentProps {
  delulus: FormattedDelulu[];
  onDeluluClick: (delulu: FormattedDelulu) => void;
  isLoading?: boolean;
}

function isEndingSoon(deadline: Date): boolean {
  const diff = deadline.getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  return hours > 0 && hours <= 24;
}

export function AllDelulusContent({
  delulus,
  onDeluluClick,
  isLoading = false,
}: AllDelulusContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const endingSoon = [...delulus].sort((a, b) => Number(b.id) - Number(a.id)).filter((d) => isEndingSoon(d.stakingDeadline));
  const regularDelulusUnfiltered = useMemo(() => {
    const allDelulusSorted = [...delulus].sort((a, b) => Number(b.id) - Number(a.id));
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

  return (
    <div className="max-w-lg md:max-w-7xl text-center mx-auto pb-8">
      <div className="text-center mb-6">
        <Link
          href="/"
          className="flex text-center justify-center items-center gap-1"
        >
          <span
            className="text-2xl font-black text-white tracking-tighter"
            style={{ fontFamily: "var(--font-gloria)" }}
          >
            delulus
          </span>
          <span className="w-2 h-2 rounded-full bg-black" />
        </Link>
      </div>

      <div className="h-px bg-black/80 mb-6" />

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delulus..."
            className="w-full pl-10 pr-10 py-3 bg-black border border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:outline-none focus:border-gray-700 transition-colors"
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
            <Clock className="w-4 h-4 text-white/50" />
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Ending Soon
            </span>
          </div>
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-x-visible pb-2 snap-x snap-mandatory md:snap-none scrollbar-hide">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="shrink-0 w-[200px] sm:w-[240px] md:w-full bg-black rounded-xl p-3 border border-white/10 animate-pulse"
              >
                <div className="h-3 bg-black/80 rounded w-3/4 mb-2" />
                <div className="h-2 bg-black/80 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : endingSoon.length > 0 ? (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-white/50" />
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Ending Soon
            </span>
          </div>
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-x-visible pb-2 snap-x snap-mandatory md:snap-none scrollbar-hide">
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
            <Clock className="w-4 h-4 text-white/50" />
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
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
          <TrendingUp className="w-4 h-4 text-white/50" />
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
            Trending
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <DeluluCardSkeleton key={i} index={i} className="w-full" />
            ))}
          </div>
        ) : regularDelulus.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full">
            {regularDelulus.map((delulu) => (
              <DeluluCard
                key={delulu.id}
                delusion={delulu}
                onClick={() => onDeluluClick(delulu)}
                className="w-full"
                isLast={true}
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
  );
}
