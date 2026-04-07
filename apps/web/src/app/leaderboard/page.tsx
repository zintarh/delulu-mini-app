"use client";

import { useState } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useDeluluLeaderboard } from "@/hooks/graph/useDeluluLeaderboard";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import type { DeluluLeaderboardEntry } from "@/hooks/graph/useDeluluLeaderboard";

const PAGE_SIZE = 10;

const RANK_STYLES: Record<number, { badge: string; row: string }> = {
  1: {
    badge: "bg-[#fcff52] text-black shadow-[0_0_10px_rgba(252,255,82,0.4)]",
    row: "bg-[#fcff52]/5",
  },
  2: {
    badge: "bg-zinc-600 text-white",
    row: "",
  },
  3: {
    badge: "bg-[#35d07f]/30 text-[#35d07f]",
    row: "bg-[#35d07f]/5",
  },
};

function formatName(entry: DeluluLeaderboardEntry) {
  if (entry.creatorUsername) return `@${entry.creatorUsername}`;
  const a = entry.creatorAddress;
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

function formatTitle(entry: DeluluLeaderboardEntry) {
  const text = entry.title ?? `Delulu #${entry.onChainId}`;
  return text.length > 40 ? text.slice(0, 40) + "…" : text;
}

export default function LeaderboardPage() {
  const [page, setPage] = useState(0);

  const { entries, hasNextPage, isLoading, error, refetch } =
    useDeluluLeaderboard(PAGE_SIZE, page);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  const chainId = useChainId();
  const deluluContractAddress = getDeluluContractAddress(chainId);
  const celoscanContractUrl = `https://celoscan.io/address/${deluluContractAddress}`;

  const { totalSupply: gTotalSupply, isLoading: isLoadingGSupply } =
    useGoodDollarTotalSupply();
  const formattedGAmount =
    typeof gTotalSupply === "number" ? formatGAmount(gTotalSupply) : null;

  return (
    <div className="h-screen overflow-y-auto scrollbar-hide bg-background relative">
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-[#fcff52]/4 blur-[140px]" />
      </div>

      <div className="relative max-w-2xl sm:max-w-3xl mx-auto px-4 pt-8 pb-20">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {formattedGAmount && !isLoadingGSupply && (
            <Link
              href={celoscanContractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <img
                src="/gooddollar-logo.png"
                alt="G$"
                className="w-3.5 h-3.5 object-contain"
              />
              <span className="font-bold text-foreground">{formattedGAmount}</span>
              <span className="text-muted-foreground hidden sm:inline">circulating</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
            </Link>
          )}
        </div>

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#fcff52]/10 border-2 border-[#fcff52]/20 mb-4">
            <Trophy className="w-7 h-7 text-[#fcff52]" />
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black text-foreground"
            style={{ fontFamily: "var(--font-gloria), cursive" }}
          >
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ranked by unique buyers (UB)
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-semibold text-destructive mb-1">Failed to load leaderboard</p>
            <p className="text-sm text-muted-foreground mb-4">Something went wrong.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-semibold border border-border rounded-lg bg-background hover:bg-muted transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && entries.length === 0 && (
          <div className="text-center py-24">
            <Trophy className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">No delulus yet. Be the first!</p>
          </div>
        )}

        {/* List */}
        {!isLoading && !error && entries.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
                <div className="w-7 shrink-0" />
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Creator
                </span>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <span className="w-10 sm:w-12 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    G$
                  </span>
                  <span className="w-10 sm:w-12 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Shares
                  </span>
                  <span className="w-6 sm:w-8 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    UB
                  </span>
                </div>
              </div>

              {entries.map((entry, idx) => {
                const rank = rangeStart + idx;
                const styles = RANK_STYLES[rank] ?? {
                  badge: "bg-muted/60 text-muted-foreground",
                  row: "",
                };

                return (
                  <Link
                    key={entry.id}
                    href={`/delulu/${entry.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors",
                      styles.row,
                    )}
                  >
                    {/* Rank */}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                        styles.badge,
                      )}
                    >
                      {rank}
                    </div>

                    {/* Title + creator */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug truncate">
                        {formatTitle(entry)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatName(entry)}
                        <span className="mx-1 opacity-40">·</span>
                        <span className="opacity-50">#{entry.onChainId}</span>
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                      <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                        {formatGAmount(entry.totalG)}
                      </span>
                      <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                        {entry.shareSupply}
                      </span>
                      <span className="w-6 sm:w-8 text-right text-xs sm:text-sm font-bold text-[#fcff52] tabular-nums">
                        {entry.uniqueBuyerCount}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center pt-1 text-xs text-muted-foreground">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted font-semibold transition-colors"
              >
                ← Prev
              </button>
              <span className="font-medium">
                {rangeStart}–{rangeEnd}
                {hasNextPage && "+"}
              </span>
              <button
                type="button"
                disabled={!hasNextPage}
                onClick={() => {
                  if (hasNextPage) setPage((p) => p + 1);
                }}
                className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted font-semibold transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
