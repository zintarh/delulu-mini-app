"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { useAccount } from "wagmi";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useCreatorLeaderboard } from "@/hooks";
import { cn, formatGAmount } from "@/lib/utils";

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
  const pageSize = 20;

  const { entries, isLoading, error: leaderboardError } = useCreatorLeaderboard(
    pageSize,
    page * pageSize
  );

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
                Creator leaderboard
              </h1>
              <p className="mt-1 text-sm text-muted-foreground font-medium">
                Ranked by completed goals, with milestones and support totals from the subgraph.
              </p>
            </header>

            {leaderboardError ? (
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                <p className="font-semibold text-destructive">Failed to load leaderboard</p>
                <p className="mt-1 text-muted-foreground">
                  {leaderboardError.message}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ensure the subgraph is deployed and exposes the CreatorStats entity (creatorStatses query). Create goals and complete milestones to populate data.
                </p>
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
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.address}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl border-2 border-border bg-card shadow-[2px_2px_0px_0px_#1A1A1A] text-xs hover:shadow-[3px_3px_0px_0px_#1A1A1A] transition-all",
                        entry.rank <= 3 && "bg-card border-foreground/20"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-sm font-semibold text-foreground">
                          #{entry.rank}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {entry.username ||
                              entry.address.slice(0, 6) +
                                "…" +
                                entry.address.slice(-4)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {entry.completedGoals}/{entry.totalGoals} goals ·{" "}
                            {entry.verifiedMilestones} verified milestones
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        <div className="font-semibold text-foreground">
                          {formatGAmount(entry.totalSupportCollected)}
                        </div>
                        <div>total support</div>
                      </div>
                    </div>
                  ))}
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
                    Page {page + 1}
                  </span>
                  <button
                    type="button"
                    disabled={entries.length < pageSize}
                    onClick={() => {
                      if (entries.length === pageSize) {
                        setPage((p) => p + 1);
                      }
                    }}
                    className="px-4 py-2 rounded-md border-2 border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted hover:border-foreground/20 transition-colors font-semibold"
                  >
                    Next
                  </button>
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

