"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Trophy } from "lucide-react";
import { useAllDelulus } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useRouter } from "next/navigation";
import type { FormattedDelulu } from "@/lib/types";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { formatGAmount } from "@/lib/utils";

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTrendingIndex, setCurrentTrendingIndex] = useState(0);
  const trendingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { delulus, isLoading } = useAllDelulus();
  const {
    challenges,
    isLoading: isChallengesLoading,
  } = useChallenges();
  const router = useRouter();
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

  const isHash = (str: string) => {
    return str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str));
  };

  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    return !isHash(delulu.content);
  };

  // For search, filter by content loaded
  const delulusWithContent = useMemo(() => {
    return delulus.filter(isContentLoaded);
  }, [delulus]);

  // For trending, show all delulus (ProfileDeluluCard handles missing content gracefully)
  const filteredDelulus = useMemo(() => {
    if (!searchQuery.trim()) {
      // For trending section, don't filter by content - show all delulus
      return delulus;
    }

    // For search, only show delulus with loaded content
    const query = searchQuery.toLowerCase().trim();
    return delulusWithContent.filter((d) => {
      const content = (d.content || "").toLowerCase();
      const username = (d.username || "").toLowerCase();
      const creator = d.creator.toLowerCase();

      return (
        content.includes(query) ||
        username.includes(query) ||
        creator.includes(query)
      );
    });
  }, [delulus, delulusWithContent, searchQuery]);

  const formatTvlUsd = (d: FormattedDelulu): string | null => {
    const tvl =
      d.totalSupportCollected ?? d.totalStake ?? 0;

    if (tvl <= 0) return null;

    const isGoodDollar =
      d.tokenAddress?.toLowerCase() ===
      GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();

    const approxUsd =
      isGoodDollar && gDollarUsdPrice
        ? tvl * gDollarUsdPrice
        : !isGoodDollar
        ? tvl // assume ~1:1 for non-G$ tokens like USDm
        : null;

    if (!approxUsd || approxUsd <= 0) return null;

    if (approxUsd < 0.01) return approxUsd.toFixed(4);
    return approxUsd.toFixed(2);
  };

  const trendingDelulus = useMemo(() => {
    return [...filteredDelulus]
      .sort(
        (a, b) =>
          (b.totalSupportCollected ?? b.totalStake ?? 0) -
          (a.totalSupportCollected ?? a.totalStake ?? 0)
      )
      .slice(0, 4);
  }, [filteredDelulus]);

  // Auto-rotate carousel every 3 minutes (180000ms)
  useEffect(() => {
    if (trendingDelulus.length <= 1) {
      setCurrentTrendingIndex(0);
      return;
    }

    // Reset to first card when trending delulus change
    setCurrentTrendingIndex(0);

    // Clear any existing interval
    if (trendingIntervalRef.current) {
      clearInterval(trendingIntervalRef.current);
    }

    // Start new interval
    trendingIntervalRef.current = setInterval(() => {
      setCurrentTrendingIndex((prev) => (prev + 1) % trendingDelulus.length);
    }, 180000); // 3 minutes

    return () => {
      if (trendingIntervalRef.current) {
        clearInterval(trendingIntervalRef.current);
      }
    };
  }, [trendingDelulus.length]);


  const activeChallenges = useMemo(
    () => challenges.filter((c) => c.active),
    [challenges]
  );

  const handleDeluluClick = (id: string | number) => {
    router.push(`/delulu/${id}`);
  };

  return (
    <aside className="h-screen sticky top-0 px-5 py-4 overflow-y-auto scrollbar-hide bg-background border-l border-border text-foreground">
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Delulus..."
            className="w-full pl-10 pr-10 py-3 bg-muted border border-border rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border focus:bg-background transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchQuery.trim() ? (
        <div className="bg-muted rounded-2xl border border-border p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-foreground">
              Search Results
            </h2>
            <span className="text-sm text-muted-foreground">
              ({filteredDelulus.length})
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-secondary rounded-xl p-3 border border-border animate-pulse"
                >
                  <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredDelulus.length > 0 ? (
            <div className="space-y-3">
              {filteredDelulus.map((delulu, idx) => (
                <button
                  key={`search-${delulu.onChainId || delulu.id}-${idx}`}
                  onClick={() => handleDeluluClick(delulu.id)}
                  className="w-full text-left p-3 rounded-xl bg-secondary hover:bg-muted transition-colors border border-border hover:border-border"
                >
                  <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">
                    {delulu.content || "YOUR DELULU HEADLINE"}
                  </p>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="bg-foreground text-background font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                     
                      {formatTvlUsd(delulu) ?? "0.00"} USD TVL
                    </span>
                  </div>
                </button>
              ))}
            </div>
            ) : null}
        </div>
      ) : (
        <>
        

          <div className="bg-secondary rounded-2xl border border-border p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-delulu-yellow-reserved" />
              <h2 className="text-lg font-bold text-foreground">
                <span
                  className="text-delulu-yellow-reserved"
                  style={{
                    textShadow: "2px 2px 0px #1A1A1A, -1px -1px 0px #1A1A1A, 1px -1px 0px #1A1A1A, -1px 1px 0px #1A1A1A"
                  }}
                >
                  Campaigns
                </span>
              </h2>
              
            </div>

            {isChallengesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-muted rounded-xl p-4 border border-border animate-pulse"
                  >
                    <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : activeChallenges.length > 0 ? (
              <div className="space-y-3">
                {activeChallenges.map((challenge, idx) => (
                  <button
                    key={`active-${challenge.id}-${idx}`}
                    onClick={() => router.push(`/campaigns/${challenge.id}`)}
                    className="w-full text-left p-4 rounded-xl bg-card hover:bg-muted transition-all duration-200 border border-border hover:border-delulu-yellow-reserved/50 hover:shadow-sm group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground mb-2 line-clamp-2 group-hover:text-delulu-yellow-reserved transition-colors">
                          {challenge.title || ""}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-delulu-yellow-reserved/10 border border-delulu-yellow-reserved/30">
                            <span className="text-xs text-foreground font-semibold tabular-nums">
                              {formatGAmount(challenge.poolAmount)} G$
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

        </>
      )}
    </aside>
  );
}
