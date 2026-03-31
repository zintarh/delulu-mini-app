"use client";

import { useState } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useCreatorLeaderboard } from "@/hooks";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import type { CreatorLeaderboardEntry } from "@/hooks/graph/useCreatorLeaderboard";

const RANK_LABELS = ["1st", "2nd", "3rd"];

export default function LeaderboardPage() {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const {
    entries: rawEntries,
    isLoading,
    error,
    refetch,
  } = useCreatorLeaderboard(pageSize + 1, page * pageSize);

  const entries = rawEntries.slice(0, pageSize);
  const hasNextPage = rawEntries.length > pageSize;
  const rangeStart = page * pageSize + 1;
  const rangeEnd = page * pageSize + entries.length;
  const isLastPage = !hasNextPage;
  const totalKnown =
    rawEntries.length <= pageSize ? page * pageSize + rawEntries.length : null;

  const chainId = useChainId();
  const deluluContractAddress = getDeluluContractAddress(chainId);
  const celoscanContractUrl = `https://celoscan.io/address/${deluluContractAddress}`;

  const { totalSupply: gTotalSupply, isLoading: isLoadingGSupply } =
    useGoodDollarTotalSupply();
  const formattedGAmount =
    typeof gTotalSupply === "number" ? formatGAmount(gTotalSupply) : null;

  const isFirstPage = page === 0;
  const topThree = isFirstPage ? entries.slice(0, Math.min(3, entries.length)) : [];
  const restEntries = isFirstPage ? entries.slice(Math.min(3, entries.length)) : entries;

  const formatName = (entry: CreatorLeaderboardEntry) =>
    entry.username
      ? `@${entry.username}`
      : `${entry.address.slice(0, 6)}…${entry.address.slice(-4)}`;

  return (
    <div className="h-screen overflow-y-auto scrollbar-hide bg-background relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-[#fcff52]/4 blur-[140px]" />
        <div className="absolute top-1/3 -right-20 w-[300px] h-[300px] rounded-full bg-[#35d07f]/3 blur-[100px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-20">
        {/* Nav bar */}
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

        {/* Hero title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#fcff52]/10 border-2 border-[#fcff52]/20 mb-5">
            <Trophy className="w-8 h-8 text-[#fcff52]" />
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black text-foreground"
            style={{ fontFamily: "var(--font-gloria), cursive" }}
          >
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Top creators ranked by G$ staked
          </p>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-28 rounded-2xl bg-muted animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 rounded-xl bg-muted animate-pulse" />
              <div className="h-24 rounded-xl bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-semibold text-destructive mb-1">
              Failed to load leaderboard
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Something went wrong. Please try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-semibold border border-border rounded-lg bg-background hover:bg-muted transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && entries.length === 0 && (
          <div className="text-center py-24">
            <Trophy className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No creators yet. Be the first to appear here!
            </p>
          </div>
        )}

        {/* Leaderboard content */}
        {!isLoading && !error && entries.length > 0 && (
          <div className="space-y-4">
            {/* Top 3 podium — first page only */}
            {isFirstPage && topThree.length > 0 && (
              <div className="space-y-3">
                {/* 1st place — featured */}
                <div className="relative rounded-2xl border-2 border-[#fcff52]/40 bg-[#fcff52]/5 p-5 overflow-hidden">
                  {/* Corner glow */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#fcff52]/15 blur-2xl pointer-events-none" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#fcff52] flex items-center justify-center shadow-[0_0_16px_rgba(252,255,82,0.4)]">
                        <span className="font-black text-black text-lg leading-none">1</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-base truncate">
                            {formatName(topThree[0])}
                          </span>
                          <span className="text-[10px] bg-[#fcff52]/20 text-[#fcff52] px-2 py-0.5 rounded-full font-bold tracking-wide flex-shrink-0">
                            1ST
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {topThree[0].totalGoals} delulus · {topThree[0].totalMilestones} milestones
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5 justify-end">
                        <img
                          src="/gooddollar-logo.png"
                          alt="G$"
                          className="w-5 h-5 object-contain"
                        />
                        <span className="font-black text-xl text-[#fcff52] tabular-nums leading-none">
                          {formatGAmount(topThree[0].totalSupportCollected)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                        G$ staked
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2nd & 3rd */}
                {topThree.length >= 2 && (
                  <div
                    className={cn(
                      "grid gap-3",
                      topThree.length === 2 ? "grid-cols-1" : "grid-cols-2"
                    )}
                  >
                    {topThree.slice(1).map((entry, i) => {
                      const rank = i + 2;
                      const isSecond = rank === 2;
                      return (
                        <div
                          key={entry.address}
                          className={cn(
                            "rounded-xl border p-4",
                            isSecond
                              ? "border-border bg-muted/20"
                              : "border-[#35d07f]/30 bg-[#35d07f]/5"
                          )}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0",
                                  isSecond
                                    ? "bg-muted text-foreground"
                                    : "bg-[#35d07f]/20 text-[#35d07f]"
                                )}
                              >
                                {rank}
                              </div>
                              <span className="font-semibold text-sm text-foreground truncate">
                                {formatName(entry)}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 tracking-wide",
                                isSecond
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-[#35d07f]/20 text-[#35d07f]"
                              )}
                            >
                              {RANK_LABELS[rank - 1].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <img
                              src="/gooddollar-logo.png"
                              alt="G$"
                              className="w-4 h-4 object-contain"
                            />
                            <span
                              className={cn(
                                "font-bold text-base tabular-nums",
                                isSecond ? "text-foreground" : "text-[#35d07f]"
                              )}
                            >
                              {formatGAmount(entry.totalSupportCollected)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {entry.totalGoals} delulus · {entry.totalMilestones} milestones
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Rest of the list (4+) */}
            {restEntries.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {restEntries.map((entry, idx) => {
                  const rank = isFirstPage
                    ? topThree.length + idx + 1
                    : rangeStart + idx;
                  return (
                    <div
                      key={entry.address}
                      className="flex items-center px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <span className="w-8 text-sm font-bold text-muted-foreground tabular-nums flex-shrink-0">
                        {rank}
                      </span>
                      <div className="flex-1 min-w-0 mx-3">
                        <span className="font-medium text-foreground text-sm block truncate">
                          {formatName(entry)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.totalGoals} delulus · {entry.totalMilestones} milestones
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <img
                          src="/gooddollar-logo.png"
                          alt="G$"
                          className="w-4 h-4 object-contain"
                        />
                        <span className="font-semibold text-sm tabular-nums text-foreground">
                          {formatGAmount(entry.totalSupportCollected)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted font-semibold transition-colors"
              >
                ← Previous
              </button>
              <span className="font-medium">
                {rangeStart}–{rangeEnd}
                {totalKnown !== null && ` of ${totalKnown}`}
                {totalKnown === null &&
                  entries.length === pageSize &&
                  "+"}
              </span>
              <button
                type="button"
                disabled={isLastPage}
                onClick={() => {
                  if (!isLastPage) setPage((p) => p + 1);
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
