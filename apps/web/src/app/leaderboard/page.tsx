"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { useAccount } from "wagmi";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useCreatorLeaderboard } from "@/hooks";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { entries, isLoading } = useCreatorLeaderboard(
    pageSize,
    page * pageSize
  );

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => {
              if (!isConnected) {
                setShowLoginSheet(true);
              } else {
                router.push("/profile");
              }
            }}
            onCreateClick={() => {
              if (!isConnected) {
                setShowLoginSheet(true);
              } else {
                router.push("/board");
              }
            }}
          />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
          <div className="max-w-3xl mx-auto px-4 py-6 lg:py-10">
            <header className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                Creator leaderboard
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ranked by completed goals, with milestones and support totals from the subgraph.
              </p>
            </header>

            {isLoading ? (
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
            ) : entries.length === 0 ? (
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
                        "flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-secondary text-xs",
                        entry.rank <= 3 && "bg-secondary/80"
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
                          {entry.totalSupportCollected.toLocaleString()}
                        </div>
                        <div>total support</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-4 text-xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1 rounded-full border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
                  >
                    Previous
                  </button>
                  <span>
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
                    className="px-3 py-1 rounded-full border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted"
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

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />
    </div>
  );
}

