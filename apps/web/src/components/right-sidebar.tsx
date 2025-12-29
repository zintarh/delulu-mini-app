"use client";

import { useState } from "react";
import { Search, X, TrendingUp } from "lucide-react";
import { useDelulus } from "@/hooks/use-delulus";
import { DeluluCard } from "@/components/delulu-card";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { delulus, isLoading } = useDelulus();
  const router = useRouter();

  const trendingDelulus = delulus
    .sort((a, b) => b.totalStake - a.totalStake)
    .slice(0, 3);

  const handleDeluluClick = (id: string) => {
    router.push(`/delulu/${id}`);
  };

  return (
    <aside className="h-screen px-6 py-4 overflow-y-auto bg-black border-l border-gray-800">
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Delulus..."
            className="w-full pl-10 pr-10 py-3 bg-gray-900 border border-gray-800 rounded-full text-white placeholder:text-white/40 focus:outline-none focus:border-gray-700 transition-colors"
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

      <div className="bg-[#0a0a0a] rounded-2xl border border-gray-800 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-white/50" />
          <h2 className="text-lg font-bold text-white">Trending Delulus</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-xl p-3 border border-gray-800 animate-pulse"
              >
                <div className="h-3 bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-2 bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : trendingDelulus.length > 0 ? (
          <div className="space-y-3">
            {trendingDelulus.map((delulu) => (
              <button
                key={delulu.id}
                onClick={() => handleDeluluClick(delulu.id)}
                className="w-full text-left p-3 rounded-xl hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700"
              >
                <p className="text-sm text-white font-medium mb-1 line-clamp-2">
                  {delulu.content || delulu.contentHash}
                </p>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="text-delulu-purple font-bold">
                    {delulu.totalStake > 0
                      ? delulu.totalStake < 0.01
                        ? delulu.totalStake.toFixed(4)
                        : delulu.totalStake.toFixed(2)
                      : "0.00"}{" "}
                    cUSD
                  </span>
                  <span>·</span>
                  <span>
                    {Math.round(
                      (delulu.totalBelieverStake /
                        (delulu.totalBelieverStake + delulu.totalDoubterStake)) *
                        100
                    )}
                    % believe
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50 text-center py-4">
            No trending delulus yet
          </p>
        )}
      </div>
    </aside>
  );
}
