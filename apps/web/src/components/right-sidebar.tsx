"use client";

import { useState, useMemo } from "react";
import { Search, X, TrendingUp } from "lucide-react";
import { useAllDelulus } from "@/hooks/graph";
import { TokenBadge } from "@/components/token-badge";
import { useRouter } from "next/navigation";
import type { FormattedDelulu } from "@/lib/types";

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { delulus, isLoading } = useAllDelulus();
  const router = useRouter();

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

  const trendingDelulus = useMemo(() => {
    return [...filteredDelulus]
      .sort((a, b) => b.totalStake - a.totalStake)
      .slice(0, 3);
  }, [filteredDelulus]);

  const recommendedDelulus = useMemo(() => {
    const available = filteredDelulus.filter(
      (d) => !trendingDelulus.some((td) => td.id === d.id)
    );
    return [...available].sort(() => Math.random() - 0.5).slice(0, 4);
  }, [filteredDelulus, trendingDelulus]);

  const handleDeluluClick = (id: string | number) => {
    router.push(`/delulu/${id}`);
  };

  return (
    <aside className="h-screen sticky top-0 px-5 py-4 overflow-y-auto bg-white border-l border-gray-200">
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Delulus..."
            className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-full text-delulu-charcoal placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchQuery.trim() ? (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-delulu-charcoal">
              Search Results
            </h2>
            <span className="text-sm text-gray-500">
              ({filteredDelulus.length})
            </span>
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
          ) : filteredDelulus.length > 0 ? (
            <div className="space-y-3">
              {filteredDelulus.map((delulu, idx) => (
                <button
                  key={`search-${delulu.onChainId || delulu.id}-${idx}`}
                  onClick={() => handleDeluluClick(delulu.id)}
                  className="w-full text-left p-3 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
                >
                  <p className="text-sm text-delulu-charcoal font-medium mb-1 line-clamp-2">
                    {delulu.content || "YOUR DELULU HEADLINE"}
                  </p>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="bg-delulu-charcoal text-white font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      {delulu.tokenAddress && (
                        <TokenBadge tokenAddress={delulu.tokenAddress} size="sm" showText={false} />
                      )}
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
              No results found
            </p>
          )}
        </div>
      ) : (
        <>
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
                {trendingDelulus.map((delulu, idx) => (
                  <button
                    key={`trending-${delulu.onChainId || delulu.id}-${idx}`}
                    onClick={() => handleDeluluClick(delulu.id)}
                    className="w-full text-left p-3 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
                  >
                    <p className="text-sm text-delulu-charcoal font-medium mb-1 line-clamp-2">
                      {delulu.content || "YOUR DELULU HEADLINE"}
                    </p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="bg-delulu-charcoal text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        {delulu.tokenAddress && (
                          <TokenBadge tokenAddress={delulu.tokenAddress} size="sm" showText={false} />
                        )}
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
                {recommendedDelulus.map((delulu, idx) => (
                  <button
                    key={`rec-${delulu.onChainId || delulu.id}-${idx}`}
                    onClick={() => handleDeluluClick(delulu.id)}
                    className="w-full text-left p-3 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300"
                  >
                    <p className="text-sm text-delulu-charcoal font-medium mb-1 line-clamp-2">
                      {delulu.content || "YOUR DELULU HEADLINE"}
                    </p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="bg-delulu-charcoal text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        {delulu.tokenAddress && (
                          <TokenBadge tokenAddress={delulu.tokenAddress} size="sm" showText={false} />
                        )}
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
        </>
      )}
    </aside>
  );
}
