"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useCreatorLeaderboard } from "@/hooks";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [page, setPage] = useState(0);

  const handleProfileClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/board");
  };
  const pageSize = 10;

  // Request one extra item to know if there's a next page (avoids enabling Next on full last page)
  const {
    entries: rawEntries,
    isLoading,
    error: leaderboardError,
    refetch,
  } = useCreatorLeaderboard(pageSize + 1, page * pageSize);

  const entries = rawEntries.slice(0, pageSize);
  const hasNextPage = rawEntries.length > pageSize;
  const totalKnown =
    rawEntries.length <= pageSize ? page * pageSize + rawEntries.length : null;
  const rangeStart = page * pageSize + 1;
  const rangeEnd = page * pageSize + entries.length;
  const isLastPage = !hasNextPage;

  const chainId = useChainId();
  const deluluContractAddress = getDeluluContractAddress(chainId);
  const celoscanContractUrl = `https://celoscan.io/address/${deluluContractAddress}`;

  const { totalSupply: gTotalSupply, isLoading: isLoadingGSupply } =
    useGoodDollarTotalSupply();
  const formattedGAmount =
    typeof gTotalSupply === "number" ? formatGAmount(gTotalSupply) : null;

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
          <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10 pb-24 lg:pb-10">
            <header className="mb-6">
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                Creator
              </h1>
              <p className="mt-1 text-sm text-muted-foreground font-medium">
                See how active creators in Delulu are progressing on their goals.
              </p>
            </header>

            {formattedGAmount !== null && !isLoadingGSupply && (
              <div className="mb-6 flex items-center gap-2 rounded-xl border-2 border-border bg-muted/30 px-4 py-3">
                <img
                  src="/gooddollar-logo.png"
                  alt="G$"
                  className="h-5 w-5 object-contain"
                />
                <span className="text-sm text-muted-foreground">
                  G$ in circulation
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {formattedGAmount}
                </span>
                <Link
                  href={celoscanContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  View on explorer
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {leaderboardError ? (
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                <p className="font-semibold text-destructive">Failed to load leaderboard</p>
                <p className="mt-1 text-muted-foreground">
                  Something went wrong while loading creator rankings. Please try again in a moment.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-3 inline-flex items-center rounded-md border-2 border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 && !leaderboardError ? (
              <p className="text-sm text-muted-foreground">
                No creator stats yet. Create a goal and complete milestones to appear here.
              </p>
            ) : (
              <>
                <div className="rounded-xl border-2 border-border bg-card overflow-hidden shadow-[2px_2px_0px_0px_#1A1A1A]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-border bg-muted/50">
                          <th className="px-4 py-3 font-semibold text-muted-foreground w-12">
                            #
                          </th>
                          <th className="px-4 py-3 font-semibold text-foreground min-w-[140px]">
                            Creator
                          </th>
                          <th className="px-4 py-3 font-semibold text-foreground text-center whitespace-nowrap">
                            Delulus
                          </th>
                          <th className="px-4 py-3 font-semibold text-foreground text-center whitespace-nowrap">
                            Points
                          </th>
                          <th className="px-4 py-3 font-semibold text-foreground text-center whitespace-nowrap">
                            Milestones
                          </th>
                          <th className="px-4 py-3 font-semibold text-foreground text-right whitespace-nowrap">
                            <img
                              src="/gooddollar-logo.png"
                              alt="G$"
                              className="inline-block w-4 h-4 object-contain align-middle"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, idx) => (
                          <tr
                            key={entry.address}
                            className={cn(
                              "border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors",
                              rangeStart + idx <= 3 && "bg-foreground/[0.03]"
                            )}
                          >
                            <td className="px-4 py-3 font-semibold text-muted-foreground tabular-nums">
                              {rangeStart + idx}
                            </td>
                            <td className="px-4 py-3 min-w-0">
                              <span className="font-medium text-foreground truncate block">
                                {entry.username ||
                                  entry.address.slice(0, 6) +
                                    "…" +
                                    entry.address.slice(-4)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                              {entry.totalGoals}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-foreground tabular-nums">
                              {entry.points.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                              {entry.totalMilestones}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                              {formatGAmount(entry.totalSupportCollected)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6 text-xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-4 py-2 rounded-md border-2 border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted hover:border-foreground/20 transition-colors font-semibold"
                  >
                    Previous
                  </button>
                  <span className="font-medium">
                    {rangeStart}–{rangeEnd}
                    {totalKnown !== null && ` of ${totalKnown}`}
                    {totalKnown === null && entries.length === pageSize && ` of ${rangeEnd}+`}
                  </span>
                  <div className="flex items-center gap-2">
                    
                    <button
                      type="button"
                      disabled={isLastPage}
                      onClick={() => {
                        if (!isLastPage) setPage((p) => p + 1);
                      }}
                      className="px-4 py-2 rounded-md border-2 border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted hover:border-foreground/20 transition-colors font-semibold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />
    </div>
  );
}

