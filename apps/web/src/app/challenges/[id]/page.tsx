"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { ChallengesHeader } from "@/components/challenges-header";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useChallenges } from "@/hooks/use-challenges";
import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { ArrowLeft, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { CampaignLeaderboardSkeleton } from "@/components/campaign-leaderboard-skeleton";
import { formatDistanceToNow } from "date-fns";
import { useAllocatePoints } from "@/hooks/use-allocate-points";
import { useChallengeLeaderboard } from "@/hooks/use-challenge-leaderboard";
import type { Challenge } from "@/hooks/use-challenges";

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { address, isConnected } = useAccount();
  const { isAdmin } = useIsAdmin();
  const { challenges, isLoading: isLoadingChallenges } = useChallenges();
  const chainId = useChainId();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [editingPoints, setEditingPoints] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState<string>("");
  const [optimisticPoints, setOptimisticPoints] = useState<Record<number, number>>({});
  const [lastAllocatedDeluluId, setLastAllocatedDeluluId] = useState<number | null>(null);

  const challengeId = params?.id ? parseInt(params.id as string) : null;
  const challenge = challengeId
    ? challenges.find((c: Challenge) => c.id === challengeId)
    : null;

  // Get the currency token address from the contract
  const { data: currencyAddress } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "currency",
  });

  const currencyTokenAddress =
    typeof currencyAddress === "string"
      ? (currencyAddress as `0x${string}`)
      : undefined;

  const { allocatePoints, isAllocating, isConfirming, isSuccess: isAllocateSuccess } = useAllocatePoints();
  const {
    leaderboard,
    isLoading: isLoadingLeaderboard,
    refetch: refetchLeaderboard,
  } = useChallengeLeaderboard(challengeId ?? null);

  const handleAllocatePoints = async (deluluId: number) => {
    const points = parseInt(pointsInput);
    if (isNaN(points) || points < 0) {
      alert("Please enter a valid number of points");
      return;
    }

    try {
      // Optimistically update points for this delulu in the UI
      setOptimisticPoints((prev) => ({
        ...prev,
        [deluluId]: points,
      }));
      setLastAllocatedDeluluId(deluluId);

      await allocatePoints(deluluId, points);
    } catch (error) {
      console.error("Failed to allocate points:", error);
      // Roll back optimistic points if the transaction fails
      setOptimisticPoints((prev) => {
        const next = { ...prev };
        delete next[deluluId];
        return next;
      });
    }
  };

  // When point allocation tx is confirmed, refresh just the leaderboard data
  useEffect(() => {
    if (isAllocateSuccess && challengeId !== null && lastAllocatedDeluluId !== null) {
      refetchLeaderboard().finally(() => {
        // Clear optimistic override once fresh data has been fetched
        setOptimisticPoints((prev) => {
          const next = { ...prev };
          delete next[lastAllocatedDeluluId];
          return next;
        });
        setEditingPoints(null);
        setPointsInput("");
        setLastAllocatedDeluluId(null);
      });
    }
  }, [isAllocateSuccess, refetchLeaderboard, challengeId, lastAllocatedDeluluId]);

  // Visual feedback: lightweight confetti when points are allocated successfully
  useEffect(() => {
    if (!isAllocateSuccess) return;

    (async () => {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = (confettiModule as any).default || confettiModule;
        if (typeof confetti === "function") {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.4 },
            colors: ["#FCD34D", "#4B5563", "#A855F7"],
          });
        }
      } catch {
        // Confetti is optional and purely visual
      }
    })();
  }, [isAllocateSuccess]);


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
          {/* Mobile Header */}
          <div className="lg:hidden">
            <ChallengesHeader
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

          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-10 pt-20 lg:pt-4 text-foreground">
            {/* Header with Back Button */}
            <div className="mb-6 sm:mb-8">
              <Link
                href="/challenges"
                className="inline-flex items-center gap-2 mb-3 sm:mb-4 text-muted-foreground hover:text-foreground transition-colors group text-sm sm:text-base"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-semibold">Back to Campaigns</span>
              </Link>

              {!challenge ? (
                <div className="flex items-center justify-center py-10">
                  {isLoadingChallenges ? (
                    <div className="w-full max-w-xl space-y-4">
                      <div className="h-7 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-5 bg-gray-200 rounded w-28" />
                    </div>
                  ) : (
                    <div className="bg-card rounded-xl border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] p-10 text-center">
                      <p className="text-muted-foreground font-medium">
                        Campaign not found
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight">
                        {challenge.title || `Campaign #${challenge.id}`}
                      </h1>
                      {challenge.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {challenge.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-muted rounded-md border border-border">
                        <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-foreground flex-shrink-0" />
                        <span className="font-bold text-sm sm:text-base">
                          {challenge.poolAmount.toFixed(2)}
                        </span>
                        {currencyTokenAddress ? (
                          <TokenBadge tokenAddress={currencyTokenAddress} size="sm" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            

            {/* Leaderboard */}
            {challenge && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-5">
                  <h2 className="text-lg sm:text-xl font-black">
                    Leaderboard
                  </h2>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Ends {formatDistanceToNow(challenge.endTime, { addSuffix: true })}
                  </div>
                </div>

                {isLoadingLeaderboard ? (
                  <CampaignLeaderboardSkeleton rows={4} />
                ) : leaderboard.length === 0 ? (
                  <div className="bg-card rounded-xl border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] p-10 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium mb-1">
                      No participants yet
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Be the first to join this campaign!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {leaderboard.map((entry, index) => {
                      const rank = index + 1;
                      const isTopThree = rank <= 3;
                      const displayPoints =
                        optimisticPoints[entry.deluluId] ?? entry.points;

                      const label =
                        entry.delulu.content && entry.delulu.content.length > 0
                          ? entry.delulu.content
                          : "";

                      return (
                        <div
                          key={entry.deluluId}
                          className={cn(
                            "bg-card rounded-lg border border-border p-2 sm:p-2",
                            isTopThree && "bg-gradient-to-r from-muted/60 to-card"
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              {/* Rank */}
                              <div className="flex-shrink-0 w-7 sm:w-8 text-center">
                                <span className="text-xs sm:text-sm font-black">
                                  #{rank}
                                </span>
                              </div>

                              {/* User Info */}
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs sm:text-sm truncate">
                                  {entry.username ||
                                    `${entry.creator.slice(0, 6)}...${entry.creator.slice(-4)}`}
                                </div>
                                {label && (
                                  <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                                    {label}
                                  </div>
                                )}
                              </div>

                              {/* Points */}
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                                <span className="text-base sm:text-lg font-black">
                                  {displayPoints}
                                </span>
                                <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                                  pts
                                </span>
                              </div>
                            </div>

                            {/* Admin Actions */}
                            {isAdmin && (
                              <div className="flex items-center gap-1.5 flex-shrink-0 self-stretch sm:self-auto">
                                <button
                                  onClick={() => {
                                    setEditingPoints(entry.deluluId);
                                    setPointsInput(
                                      (optimisticPoints[entry.deluluId] ??
                                        entry.points
                                      ).toString()
                                    );
                                  }}
                                  className="px-3 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-md border-2 border-delulu-charcoal bg-card text-foreground shadow-[2px_2px_0px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all w-full sm:w-auto"
                                >
                                  Allocate
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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

      {/* Allocate points modal */}
      {isAdmin && editingPoints !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border">
            <h3 className="text-base md:text-lg font-black mb-2">
              Allocate points
            </h3>
           
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                placeholder="Points"
                min={0}
                className="flex-1 px-3 py-2 h-[46px] text-sm rounded-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-delulu-charcoal focus:border-delulu-charcoal"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={isAllocating || isConfirming}
                onClick={() => {
                  if (!isAllocating && !isConfirming) {
                    setEditingPoints(null);
                    setPointsInput("");
                  }
                }}
                className="px-3 py-2 text-xs md:text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAllocating || isConfirming || !pointsInput}
                onClick={() => handleAllocatePoints(editingPoints)}
                className={cn(
                  "px-4 py-2 text-xs md:text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                  (isAllocating || isConfirming || !pointsInput) &&
                    "opacity-60 cursor-not-allowed"
                )}
              >
                {isAllocating || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                    Allocating...
                  </>
                ) : (
                  "Save points"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
