"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ChallengesHeader } from "@/components/challenges-header";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { CreateChallengeSheet } from "@/components/create-challenge-sheet";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useChallenges } from "@/hooks/use-challenges";
import { useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { Trophy, Clock, DollarSign } from "lucide-react";
import { cn, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { format } from "date-fns";
import { ChallengeSkeleton } from "@/components/challenge-skeleton";
import type { Challenge } from "@/hooks/use-challenges";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";




export default function ChallengesPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { isAdmin } = useIsAdmin();
  const { challenges, isLoading, error, refetch } = useChallenges();
  const chainId = useChainId();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] = useState(false);

  const handleProfileClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!isConnected) setShowLoginSheet(true);
    else router.push("/board");
  };

  const hasCampaigns = challenges.length > 0;

  const { data: currencyAddress } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "currency",
  });

  const currencyTokenAddress =
    typeof currencyAddress === "string"
      ? (currencyAddress as `0x${string}`)
      : undefined;

  const { usd: gDollarUsdPrice } = useGoodDollarPrice();

  const handleChallengeCreated = () => {
    setShowCreateChallengeSheet(false);
    setTimeout(() => {
      refetch?.();
    }, 3000);
  };



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
          {/* Mobile Header */}
          <div className="lg:hidden">
            <ChallengesHeader
              onProfileClick={handleProfileClick}
              onCreateClick={handleCreateClick}
              onSearchClick={() => {
                if (!isConnected) setShowLoginSheet(true);
                else router.push("/search");
              }}
            />
          </div>

            <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10 pt-20 lg:pt-6 pb-24 lg:pb-10 text-foreground">
            {/* Header */}
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
                  Campaigns
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
                  Active campaigns and competitions
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateChallengeSheet(true)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-1.5 sm:py-3 rounded-md border-2 border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all text-xs sm:text-sm font-bold"
                  )}
                >
                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Create Campaign</span>
                  <span className="sm:hidden">Create</span>
                </button>
              )}
            </div>

            {/* Content */}
              {error && !isLoading ? (
              <div className="bg-card rounded-xl border-2 border-border shadow-[3px_3px_0px_0px_#1A1A1A] p-12 text-center">
                <p className="text-muted-foreground font-medium">
                  Error loading campaigns: {error.message}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {isLoading ? (
                  <>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <ChallengeSkeleton key={i} />
                    ))}
                  </>
                ) : hasCampaigns ? (
                  challenges.map((challenge: Challenge) => {
                    const description = challenge.description ?? "";
                    const now = new Date();
                    const isEnded = challenge.endTime < now;
                    const dateLabel = isEnded
                      ? `Ended ${format(challenge.endTime, "MMM d, yyyy")}`
                      : `Ends ${format(challenge.endTime, "MMM d, yyyy")}`;

                    return (
                      <Link
                        key={challenge.id}
                        href={`/campaigns/${challenge.id}`}
                        className="block bg-card rounded-xl border-2 border-border shadow-[3px_3px_0px_0px_#1A1A1A] p-4 sm:p-6 hover:shadow-[4px_4px_0px_0px_#1A1A1A] hover:border-foreground/20 transition-all cursor-pointer"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center  sm:gap-3 mb-2 sm:mb-3">
                              <Trophy className="w-4 h-4 text-foreground flex-shrink-0" />
                              <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                                {challenge.title || `Campaign #${challenge.id}`}
                              </h3>
                            </div>
                            {description && (
                              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                                {description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-bold text-foreground">
                                  {formatGAmount(challenge.poolAmount)}
                                </span>
                                {currencyTokenAddress ? (
                                  <TokenBadge tokenAddress={currencyTokenAddress} size="sm" />
                                ) : null}
                                {currencyTokenAddress &&
                                  currencyTokenAddress.toLowerCase() ===
                                    GOODDOLLAR_ADDRESSES.mainnet.toLowerCase() &&
                                  gDollarUsdPrice != null &&
                                  challenge.poolAmount > 0 && (
                                    <span className="text-muted-foreground font-medium text-xs sm:text-sm">
                                      ({(challenge.poolAmount * gDollarUsdPrice).toFixed(2)} USD)
                                    </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {dateLabel}
                                </span>
                              </div>
                              {challenge.totalPoints > 0 && (
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                  <span className="text-muted-foreground">Points:</span>
                                  <span className="font-bold text-foreground">
                                    {challenge.totalPoints}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                              <div className="flex-shrink-0 self-start sm:self-auto">
                            <span
                              className={cn(
                                "inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-bold border-2 shadow-neo-sm",
                                !isEnded
                                  ? "bg-green-100 text-green-800 border-green-600 dark:bg-green-900/50 dark:text-green-200 dark:border-green-500"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {isEnded ? "Ended" : "Active"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="bg-card rounded-xl border-2 border-dashed border-border p-12 text-center">
                    <p className="text-muted-foreground font-semibold mb-2">
                      No campaigns yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin
                        ? "Launch the first campaign to get things started."
                        : "Check back soon for new campaigns."}
                    </p>
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

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />

      <CreateChallengeSheet
        open={showCreateChallengeSheet}
        onOpenChange={setShowCreateChallengeSheet}
        onSuccess={handleChallengeCreated}
      />
    </div>
  );
}
