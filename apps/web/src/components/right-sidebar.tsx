"use client";

import { useState, useMemo } from "react";
import { Search, X, TrendingUp } from "lucide-react";
import { useAllDelulus, useCreatorLeaderboard } from "@/hooks/graph";
import { useChallenges } from "@/hooks/use-challenges";
import { useRouter } from "next/navigation";
import type { FormattedDelulu } from "@/lib/types";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { delulus, isLoading } = useAllDelulus();
  const {
    challenges,
    isLoading: isChallengesLoading,
  } = useChallenges();
  const router = useRouter();
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

  // Global creator leaderboard (from subgraph)
  const {
    entries: creatorLeaderboard,
    isLoading: isLeaderboardLoading,
  } = useCreatorLeaderboard(5);

  // Helper to check if string is a hash
  const isHash = (str: string) => {
    return str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str));
  };

  // Helper to check if content is loaded (not a hash)
  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    return !isHash(delulu.content);
  };

  // Filter out delulus without loaded content
  const delulusWithContent = useMemo(() => {
    return delulus.filter(isContentLoaded);
  }, [delulus]);

  const filteredDelulus = useMemo(() => {
    if (!searchQuery.trim()) {
      return delulusWithContent;
    }

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
  }, [delulusWithContent, searchQuery]);

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

  const recommendedDelulus = useMemo(() => {
    const available = filteredDelulus.filter(
      (d) => !trendingDelulus.some((td) => td.id === d.id)
    );
    return [...available].sort(() => Math.random() - 0.5).slice(0, 4);
  }, [filteredDelulus, trendingDelulus]);

  const activeChallenges = useMemo(
    () => challenges.filter((c) => c.active),
    [challenges]
  );

  const handleDeluluClick = (id: string | number) => {
    router.push(`/delulu/${id}`);
  };

  return (
    <aside className="h-screen sticky top-0 px-5 py-4 overflow-y-auto bg-background border-l border-border text-foreground">
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No results found
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-secondary rounded-2xl border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Top creators
                </h2>
              </div>
            </div>
            {isLeaderboardLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : creatorLeaderboard.length > 0 ? (
              <div className="space-y-1.5">
                {creatorLeaderboard.map((entry) => (
                  <div
                    key={entry.address}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-right font-semibold text-foreground">
                        {entry.rank}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-foreground truncate">
                          {entry.username || entry.address.slice(0, 6) + "…" + entry.address.slice(-4)}
                        </span>
                        <span className="text-[10px]">
                          {entry.completedGoals}/{entry.totalGoals} goals ·{" "}
                          {entry.verifiedMilestones} verified milestones
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                No creator stats yet.
              </p>
            )}
          </div>

          <div className="bg-secondary rounded-2xl border border-border p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">
                Trending{" "}
                <span
                  className="text-delulu-yellow-reserved"
                  style={{
                    fontFamily: "var(--font-gloria), cursive",
                    textShadow: "2px 2px 0px #1A1A1A, -1px -1px 0px #1A1A1A, 1px -1px 0px #1A1A1A, -1px 1px 0px #1A1A1A"
                  }}
                >
                  delulus
                </span>
              </h2>
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
            ) : trendingDelulus.length > 0 ? (
              <div className="space-y-3">
                {trendingDelulus.map((delulu, idx) => (
                  <button
                    key={`trending-${delulu.onChainId || delulu.id}-${idx}`}
                    onClick={() => handleDeluluClick(delulu.id)}
                    className="w-full text-left p-3 rounded-xl bg-secondary hover:bg-muted transition-colors border border-border hover:border-border"
                  >
                    <p className="text-sm text-muted-foreground font-medium mb-1 line-clamp-2">
                      {delulu.content || "YOUR DELULU HEADLINE"}
                    </p>
                  
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No trending delulus yet
              </p>
            )}
          </div>

          <div className="bg-muted rounded-2xl border border-border p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-foreground">
                Active campaigns
              </h2>
              <span className="text-sm text-muted-foreground">
                ({activeChallenges.length})
              </span>
            </div>

            {isChallengesLoading ? (
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
            ) : activeChallenges.length > 0 ? (
              <div className="space-y-3">
                {activeChallenges.map((challenge, idx) => (
                  <button
                    key={`active-${challenge.id}-${idx}`}
                    onClick={() => router.push(`/challenges/${challenge.id}`)}
                    className="w-full text-left p-3 rounded-xl bg-secondary hover:bg-muted transition-colors border border-border hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-foreground font-medium line-clamp-1">
                        {challenge.title || "Untitled campaign"}
                      </p>
                      <span className="text-xs font-bold">
                        G${" "}
                        {challenge.poolAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active campaigns yet
              </p>
            )}
          </div>

        </>
      )}
    </aside>
  );
}
