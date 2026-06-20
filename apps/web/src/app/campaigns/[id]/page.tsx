"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ChallengesHeader } from "@/components/challenges-header";
import { useAuth } from "@/hooks/use-auth";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useChallenges } from "@/hooks/use-challenges";
import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { ArrowLeft, Trophy, Loader2 } from "lucide-react";
import { cn, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { CampaignLeaderboardSkeleton } from "@/components/campaign-leaderboard-skeleton";
import type { Challenge } from "@/hooks/use-challenges";

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { address } = useAccount();
  const { authenticated } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { challenges, isLoading: isLoadingChallenges } = useChallenges();
  const chainId = useChainId();

  const handleProfileClick = () => {
    if (!authenticated) redirectToSignIn();
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!authenticated) redirectToSignIn();
    else router.push("/board");
  };

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

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar />
        </div>

        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background">
          {/* Mobile Header */}
          <div className="lg:hidden">
            <ChallengesHeader
              onProfileClick={handleProfileClick}
              onCreateClick={handleCreateClick}
              onSearchClick={() => {
                if (!authenticated) redirectToSignIn();
                else router.push("/search");
              }}
            />
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-10 pt-20 lg:pt-4 pb-24 lg:pb-10 text-foreground">
            {/* Header with Back Button */}
            <div className="mb-6 sm:mb-8">
              <Link
                href="/campaigns"
                className="inline-flex items-center gap-2 mb-3 sm:mb-4 text-muted-foreground hover:text-foreground transition-colors group text-sm sm:text-base"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-semibold">Back to Campaigns</span>
              </Link>

              {!challenge ? (
                <div className="flex items-center justify-center py-10">
                  {isLoadingChallenges ? (
                    <div className="w-full max-w-xl space-y-4">
                      <div className="h-7 bg-muted rounded w-1/3 animate-pulse" />
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                      <div className="h-5 bg-muted rounded w-28 animate-pulse" />
                    </div>
                  ) : (
                    <div className="bg-card rounded-xl border-2 border-border shadow-[3px_3px_0px_0px_#1a1a19] p-10 text-center">
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
                          {formatGAmount(challenge.poolAmount)}
                        </span>
                        {currencyTokenAddress ? (
                          <TokenBadge tokenAddress={currencyTokenAddress} size="sm" />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <Suspense fallback={<CampaignLeaderboardSkeleton rows={4} />}>
                    <LeaderboardContent 
                      challengeId={challengeId}
                      challenge={challenge}
                    />
                  </Suspense>
                </>
              )}
            </div>
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
    </div>
  );
}

function LeaderboardContent({ challengeId, challenge }: { challengeId: number | null; challenge: Challenge | undefined }) {
  const { isAdmin } = useIsAdminImport();
  const [editingPoints, setEditingPoints] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState<string>("");
  const [optimisticPoints, setOptimisticPoints] = useState<Record<number, number>>({});
  const [lastAllocatedDeluluId, setLastAllocatedDeluluId] = useState<number | null>(null);

  const { allocatePoints, isAllocating, isConfirming, isSuccess: isAllocateSuccess } = useAllocatePointsImport();
  const {
    leaderboard,
    isLoading: isLoadingLeaderboard,
    error: leaderboardError,
    refetch: refetchLeaderboard,
  } = useChallengeLeaderboardImport(challengeId ?? null);

  const {
    challenge: onChainChallenge,
    canRefund,
    canWithdrawAsFunder,
    isRefunded,
    isLoading: isLoadingOnChainChallenge,
    refetch: refetchOnChainChallenge,
  } = useChallengeOnChainImport(challengeId);

  const {
    refundChallengePool,
    isPending: isRefunding,
    isSuccess: isRefundSuccess,
    errorMessage: refundErrorMessage,
  } = useRefundChallengePoolImport();

  useEffect(() => {
    if (!isRefundSuccess || challengeId === null) return;
    void refetchOnChainChallenge();
    void refetchLeaderboard();
    const t = setTimeout(() => {
      refetchLeaderboard();
    }, 3000);
    return () => clearTimeout(t);
  }, [isRefundSuccess, challengeId, refetchOnChainChallenge, refetchLeaderboard]);

  const handleAllocatePoints = async (deluluId: number) => {
    const points = parseInt(pointsInput);
    if (isNaN(points) || points < 0) {
      alert("Please enter a valid number of points");
      return;
    }

    try {
      setOptimisticPoints((prev) => ({
        ...prev,
        [deluluId]: points,
      }));
      setLastAllocatedDeluluId(deluluId);
      await allocatePoints(deluluId, points);
    } catch (error) {
      console.error("Failed to allocate points:", error);
      setOptimisticPoints((prev) => {
        const next = { ...prev };
        delete next[deluluId];
        return next;
      });
    }
  };

  useEffect(() => {
    if (isAllocateSuccess && challengeId !== null && lastAllocatedDeluluId !== null) {
      refetchLeaderboard().finally(() => {
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
        // Confetti is optional
      }
    })();
  }, [isAllocateSuccess]);

  if (!challenge) return null;

  const isCampaignEnded = challenge.endTime < new Date();
  const endDateLabel = isCampaignEnded
    ? `Ended ${formatDate(challenge.endTime, "MMM d, yyyy")}`
    : `Ends ${formatDate(challenge.endTime, "MMM d, yyyy")}`;

  return (
    <>
      {challenge && canWithdrawAsFunder ? (
        <CampaignRefundPanelImport
          className="mb-6"
          challengeId={challenge.id}
          poolAmount={onChainChallenge?.poolAmount ?? challenge.poolAmount}
          totalPoints={onChainChallenge?.totalPoints ?? challenge.totalPoints}
          currencyTokenAddress={undefined}
          canRefund={canRefund}
          isRefunded={isRefunded}
          isLoading={isLoadingOnChainChallenge}
          isPending={isRefunding}
          isSuccess={isRefundSuccess}
          errorMessage={refundErrorMessage}
          onRefund={() => void refundChallengePool(challenge.id)}
        />
      ) : null}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-black">Leaderboard</h2>
          <div className="text-xs sm:text-sm text-muted-foreground">{endDateLabel}</div>
        </div>

        {leaderboardError ? (
          <div className="bg-card rounded-xl border-2 border-border shadow-neo p-4 text-sm text-foreground">
            <p className="font-semibold text-destructive">Failed to load leaderboard</p>
            <p className="mt-1 text-muted-foreground">{leaderboardError.message}</p>
          </div>
        ) : isLoadingLeaderboard ? (
          <CampaignLeaderboardSkeleton rows={4} />
        ) : leaderboard.length === 0 ? (
          <div className="bg-card rounded-xl border-2 border-border shadow-neo p-10 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium mb-1">No participants yet</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const displayPoints = optimisticPoints[entry.deluluId] ?? entry.points;
              return (
                <div key={entry.deluluId} className="bg-card rounded-xl border-2 border-border shadow-[2px_2px_0px_0px_#1a1a19] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-black">#{rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm truncate">
                          {entry.username || `${entry.creator.slice(0, 6)}...${entry.creator.slice(-4)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-base font-black">{displayPoints}</span>
                        <span className="text-[11px] text-muted-foreground font-medium">pts</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingPoints(entry.deluluId);
                          setPointsInput((optimisticPoints[entry.deluluId] ?? entry.points).toString());
                        }}
                        className="px-3 py-1 text-[11px] font-bold rounded-md border-2 border-border bg-card text-foreground"
                      >
                        Allocate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && editingPoints !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border">
            <h3 className="text-base md:text-lg font-black mb-2">Allocate points</h3>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                placeholder="Points"
                min={0}
                className="flex-1 px-3 py-2 h-[46px] text-sm rounded-sm border border-border bg-background text-foreground"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={isAllocating || isConfirming}
                onClick={() => {
                  setEditingPoints(null);
                  setPointsInput("");
                }}
                className="px-3 py-2 text-xs font-semibold rounded-md border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAllocating || isConfirming || !pointsInput}
                onClick={() => handleAllocatePoints(editingPoints)}
                className="px-4 py-2 text-xs font-black rounded-md border-2 bg-delulu-yellow-reserved"
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
    </>
  );
}

// Import aliases to avoid circular dependencies
import { useIsAdmin as useIsAdminImport } from "@/hooks/use-is-admin";
import { format as formatDate } from "date-fns";
import { useAllocatePoints as useAllocatePointsImport } from "@/hooks/use-allocate-points";
import { useChallengeLeaderboard as useChallengeLeaderboardImport } from "@/hooks/use-challenge-leaderboard";
import { useChallengeOnChain as useChallengeOnChainImport } from "@/hooks/use-challenge-on-chain";
import { useRefundChallengePool as useRefundChallengePoolImport } from "@/hooks/use-refund-challenge-pool";
import { CampaignRefundPanel as CampaignRefundPanelImport } from "@/components/campaign-refund-panel";
