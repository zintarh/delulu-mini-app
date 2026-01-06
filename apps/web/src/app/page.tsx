"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { AllDelulusSheet } from "@/components/all-delulus-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { StakingSheet } from "@/components/staking-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";
import { useUserStats } from "@/hooks/use-user-stats";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { TrendingUp, Plus } from "lucide-react";

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const { delulus, isLoading } = useDelulus();

  const {
    totalDelulus: createdCount,
    totalStaked: totalStakes,
    totalClaimed: totalEarnings,
    isLoading: isLoadingStats,
  } = useUserStats();

  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(
    null
  );
  const [howItWorksSheetOpen, setHowItWorksSheetOpen] = useState(false);
  const [howItWorksType, setHowItWorksType] = useState<
    "concept" | "market" | "conviction"
  >("concept");
  const [allDelulusSheetOpen, setAllDelulusSheetOpen] = useState(false);
  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [claimRewardsSheetOpen, setClaimRewardsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"vision" | "fyp">("fyp");
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [stakedDeluluIds, setStakedDeluluIds] = useState<Set<number>>(
    new Set()
  );
  const [isLoadingStaked, setIsLoadingStaked] = useState(false);
  const prevDeluluIdsRef = useRef<string>("");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    const mainElement = document.querySelector("main");
    const windowElement = window;

    if (mainElement) {
      mainElement.addEventListener("scroll", handleScroll);
    }
    windowElement.addEventListener("scroll", handleScroll);

    return () => {
      if (mainElement) {
        mainElement.removeEventListener("scroll", handleScroll);
      }
      windowElement.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Check user positions for all delulus when vision tab is active
  useEffect(() => {
    // Skip if delulu IDs haven't actually changed
    const currentIds = delulus
      .map((d) => d.id)
      .sort((a, b) => a - b)
      .join(",");
    if (prevDeluluIdsRef.current === currentIds && currentIds !== "") {
      return;
    }
    prevDeluluIdsRef.current = currentIds;

    if (
      activeTab === "vision" &&
      isConnected &&
      address &&
      delulus.length > 0
    ) {
      setIsLoadingStaked(true);
      const checkStakes = async () => {
        const stakedIds = new Set<number>();

        // Check each delulu to see if user has staked using contract reads
        // Note: This makes multiple contract calls - in production you'd want to batch these
        // Create public client once
        const publicClient = createPublicClient({
          chain: celo,
          transport: http(),
        });

        const checks = delulus.map(async (delulu) => {
          try {
            const result = await publicClient.readContract({
              address: DELULU_CONTRACT_ADDRESS,
              abi: DELULU_ABI,
              functionName: "getUserPosition",
              args: [BigInt(delulu.id), address as `0x${string}`],
            });

            // Check if user has staked (amount > 0)
            if (Array.isArray(result)) {
              const [amount] = result;
              if (amount > 0n) {
                stakedIds.add(delulu.id);
              }
            } else if (
              result &&
              typeof result === "object" &&
              "amount" in result
            ) {
              if ((result as { amount: bigint }).amount > 0n) {
                stakedIds.add(delulu.id);
              }
            }
          } catch (error) {
            // Silently fail for individual checks
            console.error(
              `Error checking stake for delulu ${delulu.id}:`,
              error
            );
          }
        });

        await Promise.all(checks);
        setStakedDeluluIds(stakedIds);
        setIsLoadingStaked(false);
      };

      checkStakes();
    } else if (activeTab !== "vision") {
      setStakedDeluluIds(new Set());
      setIsLoadingStaked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isConnected, address, delulus.length]);

  // Filter delulus based on active tab
  const filteredDelulus = useMemo(() => {
    if (activeTab === "vision") {
      // For Vision tab, show only delulus where user has staked
      if (!isConnected || !address) {
        return [];
      }
      return delulus.filter((delulu) => stakedDeluluIds.has(delulu.id));
    } else {
      // For "For You" tab, show all delulus (randomized)
      const shuffled = [...delulus].sort(() => Math.random() - 0.5);
      return shuffled;
    }
  }, [delulus, activeTab, stakedDeluluIds, isConnected, address]);

  const trendingDelusions = filteredDelulus.slice(0, 5);

  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => router.push("/profile")}
            onCreateClick={() => router.push("/board")}
          />
        </div>

        <main className="h-screen lg:border-x border-gray-200 overflow-y-auto">
          <div className="lg:hidden">
            <Navbar
              onProfileClick={() => router.push("/profile")}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          <div className="hidden lg:block sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200">
            <div className="flex items-center justify-center gap-1 h-14">
              <button
                onClick={() => setActiveTab("vision")}
                className={cn(
                  "px-4 h-full flex items-center justify-center text-base font-bold transition-colors relative",
                  activeTab === "vision"
                    ? "text-delulu-charcoal"
                    : "text-gray-400 hover:text-delulu-charcoal"
                )}
              >
                Vision
                {activeTab === "vision" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("fyp")}
                className={cn(
                  "px-4 h-full flex items-center justify-center text-base font-medium transition-colors relative",
                  activeTab === "fyp"
                    ? "text-delulu-charcoal"
                    : "text-gray-400 hover:text-delulu-charcoal"
                )}
              >
                For you
                {activeTab === "fyp" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
                )}
              </button>
            </div>
          </div>

          <div className="px- lg:px-6 py-6 space-y-6 pb-32 lg:pb-6 pt-20 lg:pt-6">
            {isLoading || (activeTab === "vision" && isLoadingStaked) ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <DeluluCardSkeleton key={i} index={i} />
                ))}
              </div>
            ) : filteredDelulus.length > 0 ? (
              <div className="flex flex-col">
                {filteredDelulus.map((delusion, index) => {
                  // Use a composite key to ensure uniqueness (id + onChainId)
                  const uniqueKey = delusion.onChainId 
                    ? `${delusion.id}-${delusion.onChainId}` 
                    : `delulu-${delusion.id}-${index}`;
                  
                  return (
                    <DeluluCard
                      key={uniqueKey}
                      delusion={delusion}
                      href={`/delulu/${delusion.id}`}
                      onStake={() => {
                        setSelectedDelulu(delusion);
                        setStakingSheetOpen(true);
                      }}
                      isLast={index === filteredDelulus.length - 1}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  {activeTab === "vision"
                    ? "You haven't staked on any delulus yet"
                    : "No delulus yet"}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {activeTab === "vision"
                    ? "Stake on a delulu to see it here"
                    : "Start by creating your first delulu"}
                </p>
              </div>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <button
        onClick={() => router.push("/board")}
        className="lg:hidden fixed bottom-6 right-6 w-16 h-16 rounded-md bg-delulu-yellow-reserved text-delulu-charcoal flex items-center justify-center border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] hover:scale-110 transition-all duration-300 z-40"
        title="Create"
        aria-label="Create"
      >
        <Plus className="w-8 h-8" />
      </button>

      <HowItWorksSheet
        open={howItWorksSheetOpen}
        onOpenChange={setHowItWorksSheetOpen}
        type={howItWorksType}
      />

      <AllDelulusSheet
        open={allDelulusSheetOpen}
        onOpenChange={setAllDelulusSheetOpen}
        delulus={delulus}
        isLoading={isLoading}
        onDeluluClick={(delulu) => {
          router.push(`/delulu/${delulu.id}`);
        }}
      />

      <StakingSheet
        open={stakingSheetOpen}
        onOpenChange={setStakingSheetOpen}
        delulu={selectedDelulu}
      />

      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={() => {
          disconnect();
          useUserStore.getState().logout();
          setLogoutSheetOpen(false);
        }}
      />

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />
    </div>
  );
}
