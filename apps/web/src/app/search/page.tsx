"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { formatGAmount } from "@/lib/utils";
import { DeluluCard } from "@/components/delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { Search, X, ArrowLeft, TrendingUp } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

// Helper to check if content is loaded (not a hash)
const isContentLoaded = (delulu: FormattedDelulu): boolean => {
  if (!delulu.content) return false;
  const isHash = delulu.content.startsWith("Qm") || 
    (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
  return !isHash;
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated } = usePrivy();
  const { delulus, isLoading } = useAllDelulus();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter out delulus without loaded content (hooks must run unconditionally)
  const delulusWithContent = useMemo(() => {
    return delulus.filter(isContentLoaded);
  }, [delulus]);

  const trendingDelulus = useMemo(() => {
    return delulusWithContent
      .sort((a, b) => b.totalStake - a.totalStake)
      .slice(0, 3);
  }, [delulusWithContent]);

  const recommendedDelulus = useMemo(() => {
    if (delulusWithContent.length === 0) return [];
    const trendingIds = new Set(trendingDelulus.map((d) => d.id));
    const availableDelulus = delulusWithContent.filter((d) => !trendingIds.has(d.id));
    const shuffled = [...availableDelulus].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, [delulusWithContent, trendingDelulus]);

  const filteredDelulus = useMemo(() => {
    if (!searchQuery.trim()) return [];
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

  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam) setSearchQuery(queryParam);
  }, [searchParams]);

  useEffect(() => {
    if (!authenticated) router.replace("/");
  }, [authenticated, router]);

  if (!authenticated) return null;

  const handleDeluluClick = (id: string | number) => {
    router.push(`/delulu/${id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Delulus..."
                className="w-full pl-10 pr-10 py-3 bg-muted border border-border rounded-full text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-border focus:bg-background transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 pt-24 pb-8">
        {!authenticated ? null : isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <DeluluCardSkeleton key={i} index={i} />
            ))}
          </div>
        ) : searchQuery.trim() ? (
          filteredDelulus.length > 0 ? (
            <div className="flex flex-col">
              <p className="text-sm text-muted-foreground mb-4">
                Found {filteredDelulus.length} result{filteredDelulus.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-col">
                {filteredDelulus.map((delusion, index) => {
                  const uniqueKey = delusion.onChainId 
                    ? `${delusion.id}-${delusion.onChainId}` 
                    : `delulu-${delusion.id}-${index}`;
                  
                  return (
                    <DeluluCard
                      key={uniqueKey}
                      delusion={delusion}
                      href={`/delulu/${delusion.id}`}
                      onStake={() => {}}
                      isLast={index === filteredDelulus.length - 1}
                      feedMilestones={(delusion as any).feedMilestones}
                      totalMilestoneCount={(delusion as any).totalMilestoneCount}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm mb-2">No results found</p>
              <p className="text-muted-foreground/80 text-xs">
                Try searching with different keywords
              </p>
            </div>
          )
        ) : (
          <div>
            <div className="bg-muted/50 rounded-2xl border border-border p-4 mb-6">
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
                      className="bg-card rounded-xl p-3 border border-border animate-pulse"
                    >
                      <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : trendingDelulus.length > 0 ? (
                <div className="space-y-3">
                  {trendingDelulus.map((delulu) => (
                    <button
                      key={delulu.id}
                      onClick={() => handleDeluluClick(delulu.id)}
                      className="w-full text-left p-3 rounded-xl bg-card hover:bg-muted transition-colors border border-border hover:border-border"
                    >
                      <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">
                        {delulu.content || "YOUR DELULU HEADLINE"}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-primary text-primary-foreground font-bold px-2 py-0.5 rounded-full">
                          {formatGAmount(delulu.totalStake)} G$
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No trending delulus yet
                </p>
              )}
            </div>

            {recommendedDelulus.length > 0 && (
              <div className="bg-muted/50 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-foreground">
                    Delulus you may like
                  </h2>
                </div>

                <div className="space-y-3">
                  {recommendedDelulus.map((delulu) => (
                    <button
                      key={delulu.id}
                      onClick={() => handleDeluluClick(delulu.id)}
                      className="w-full text-left p-3 rounded-xl bg-card hover:bg-muted transition-colors border border-border hover:border-border"
                    >
                      <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">
                        {delulu.content || "YOUR DELULU HEADLINE"}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-primary text-primary-foreground font-bold px-2 py-0.5 rounded-full">
                          {formatGAmount(delulu.totalStake)} G$
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
