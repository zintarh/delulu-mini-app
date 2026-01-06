"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";
import { DeluluCard } from "@/components/delulu-card";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { Search, X, ArrowLeft, TrendingUp } from "lucide-react";
import { useAccount } from "wagmi";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useAccount();
  const { delulus, isLoading } = useDelulus();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [searchParams]);

  const trendingDelulus = useMemo(() => {
    return delulus
      .sort((a, b) => b.totalStake - a.totalStake)
      .slice(0, 3);
  }, [delulus]);

  const recommendedDelulus = useMemo(() => {
    if (delulus.length === 0) return [];
    
    // Exclude trending delulus from recommendations
    const trendingIds = new Set(trendingDelulus.map(d => d.id));
    const availableDelulus = delulus.filter(d => !trendingIds.has(d.id));
    
    // Randomly shuffle and take 4
    const shuffled = [...availableDelulus].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, [delulus, trendingDelulus]);

  const filteredDelulus = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase().trim();
    return delulus.filter((d) => {
      const content = (d.content || d.contentHash || "").toLowerCase();
      const username = (d.username || "").toLowerCase();
      const creator = d.creator.toLowerCase();

      return (
        content.includes(query) ||
        username.includes(query) ||
        creator.includes(query)
      );
    });
  }, [delulus, searchQuery]);

  const handleDeluluClick = (id: string | number) => {
    router.push(`/delulu/${id}`);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-4 pt-20 pb-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Please connect your wallet to search</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Delulus..."
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-full text-delulu-charcoal placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
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
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <DeluluCardSkeleton key={i} index={i} />
            ))}
          </div>
        ) : searchQuery.trim() ? (
          filteredDelulus.length > 0 ? (
            <div className="flex flex-col">
              <p className="text-sm text-gray-500 mb-4">
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
                      onStake={() => {
                        // Handle stake action if needed
                      }}
                      isLast={index === filteredDelulus.length - 1}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm mb-2">No results found</p>
              <p className="text-gray-400 text-xs">
                Try searching with different keywords
              </p>
            </div>
          )
        ) : (
          <div>
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-bold text-delulu-charcoal">
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
                      className="bg-white rounded-xl p-3 border border-gray-200 animate-pulse"
                    >
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : trendingDelulus.length > 0 ? (
                <div className="space-y-3">
                  {trendingDelulus.map((delulu) => (
                    <button
                      key={delulu.id}
                      onClick={() => handleDeluluClick(delulu.id)}
                      className="w-full text-left p-3 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
                    >
                      <p className="text-sm text-delulu-charcoal font-medium mb-1 line-clamp-2">
                        {delulu.content || delulu.contentHash}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-delulu-charcoal text-white font-bold px-2 py-0.5 rounded-full">
                          $
                          {delulu.totalStake > 0
                            ? delulu.totalStake < 0.01
                              ? delulu.totalStake.toFixed(4)
                              : delulu.totalStake.toFixed(2)
                            : "0.00"}{" "}
                          TVL
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No trending delulus yet
                </p>
              )}
            </div>

            {recommendedDelulus.length > 0 && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-delulu-charcoal">
                    Delulus you may like
                  </h2>
                </div>

                <div className="space-y-3">
                  {recommendedDelulus.map((delulu) => (
                    <button
                      key={delulu.id}
                      onClick={() => handleDeluluClick(delulu.id)}
                      className="w-full text-left p-3 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
                    >
                      <p className="text-sm text-delulu-charcoal font-medium mb-1 line-clamp-2">
                        {delulu.content || delulu.contentHash}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-delulu-charcoal text-white font-bold px-2 py-0.5 rounded-full">
                          $
                          {delulu.totalStake > 0
                            ? delulu.totalStake < 0.01
                              ? delulu.totalStake.toFixed(4)
                              : delulu.totalStake.toFixed(2)
                            : "0.00"}{" "}
                          TVL
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
