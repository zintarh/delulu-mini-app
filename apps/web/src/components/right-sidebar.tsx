"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowRight, ExternalLink, Search, X } from "lucide-react";
import { useAllDelulus, useCreatorLeaderboard } from "@/hooks/graph";
import { useRouter } from "next/navigation";
import type { FormattedDelulu } from "@/lib/types";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";

const DELULU_MONDAY_NOTION_URL =
  "https://flower-pilot-b9a.notion.site/Delulu-Monday-Apr-6-13-2026-4781ca0e2d024b65b97fd3222dcac9b4?source=copy_link";

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTrendingIndex, setCurrentTrendingIndex] = useState(0);
  const [flyerImageError, setFlyerImageError] = useState(false);
  const trendingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { delulus, isLoading } = useAllDelulus();
  const { entries: creatorEntries, isLoading: isLeaderboardLoading } =
    useCreatorLeaderboard(3, 0);
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
        

          <div className="rounded-2xl border border-border bg-card p-3 mb-6 shadow-sm">
            <div className="rounded-xl overflow-hidden border border-border/70 bg-muted/20 min-h-[240px]">
              {!flyerImageError ? (
                <img
                  src="/flyer.png"
                  alt="Delulu Monday campaign flyer"
                  className="w-full h-full object-cover"
                  onError={() => setFlyerImageError(true)}
                />
              ) : (
                <div className="w-full min-h-[180px] bg-gradient-to-br from-delulu-yellow-reserved/30 via-background to-delulu-green/20 p-4">
                 
                  <h3 className="mt-2 text-lg font-black leading-tight text-foreground">
                    Join the weekly campaign and compete for rewards.
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    If you want the branded flyer image here, add it to
                    `apps/web/public/flyer.png`.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 px-1">
             
              <p className="mt-1 text-xs text-muted-foreground">
                Read the full participation guide and rules.
              </p>
              <a
                href={DELULU_MONDAY_NOTION_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
              >
                How to participate
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* <div className="rounded-2xl border border-border bg-card p-4 mb-6 shadow-sm">
            <div className="mb-4 rounded-xl border border-delulu-yellow-reserved/30 bg-gradient-to-br from-delulu-yellow-reserved/20 via-card to-delulu-yellow-reserved/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-delulu-yellow-reserved/30 border border-delulu-yellow-reserved/40">
                    <Trophy className="h-4 w-4 text-delulu-charcoal" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground leading-none">
                      Top Creators
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      This week&apos;s highest momentum
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Top 3
                </span>
              </div>
            </div>

            {isLeaderboardLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse"
                  />
                ))}
              </div>
            ) : creatorEntries.length > 0 ? (
              <div className="space-y-2.5">
                {creatorEntries.slice(0, 3).map((entry) => (
                  <div
                    key={entry.address}
                    className="group rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black border",
                            entry.rank === 1
                              ? "bg-yellow-200/70 text-yellow-950 border-yellow-300"
                              : entry.rank === 2
                                ? "bg-slate-200/80 text-slate-700 border-slate-300"
                                : "bg-amber-200/70 text-amber-900 border-amber-300",
                          ].join(" ")}
                        >
                          {entry.rank}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-foreground group-hover:text-foreground">
                            @{entry.username || formatAddress(entry.address)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {entry.totalSupportCollected.toFixed(2)} total staked
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Points
                        </p>
                        <p className="text-xs font-black text-foreground tabular-nums">
                          {entry.points}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                No leaderboard entries yet.
              </p>
            )}

            <button
              type="button"
              onClick={() => router.push("/leaderboard")}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-delulu-charcoal bg-delulu-yellow-reserved px-3 py-2 text-sm font-black text-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] transition-transform hover:scale-[0.99]"
            >
              View leaderboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div> */}

        </>
      )}
    </aside>
  );
}
