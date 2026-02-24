"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { StakingSheet } from "@/components/staking-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useAllDelulus, useGraphUserDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { TrendingUp, Plus } from "lucide-react";

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const { 
    delulus, 
    isLoading, 
    isFetchingNextPage, 
    hasNextPage, 
    fetchNextPage 
  } = useAllDelulus();
  
  // Fetch user's created delulus for Vision tab (from The Graph)
  const { 
    delulus: userCreatedDelulus, 
    isLoading: isLoadingUserDelulus 
  } = useGraphUserDelulus("ongoing");

  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(
    null
  );
  const [howItWorksSheetOpen, setHowItWorksSheetOpen] = useState(false);
  const [howItWorksType, setHowItWorksType] = useState<
    "concept" | "market" | "conviction"
  >("concept");
  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [claimRewardsSheetOpen, setClaimRewardsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"vision" | "fyp">("fyp");
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll detection
  const scrollContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Check if user has scrolled to bottom (within 200px)
      // The main element is the scrollable container
      const mainElement = document.querySelector("main");
      const container = mainElement || document.documentElement;
      
      const scrollTop = container.scrollTop || window.scrollY;
      const scrollHeight = container.scrollHeight || document.documentElement.scrollHeight;
      const clientHeight = container.clientHeight || window.innerHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Load more when within 200px of bottom
      if (
        distanceFromBottom < 200 &&
        hasNextPage &&
        !isFetchingNextPage &&
        !isLoading &&
        activeTab === "fyp" // Only for FYP tab
      ) {
        fetchNextPage();
      }
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
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, activeTab]);


  // Helper to check if content is loaded (not a hash)
  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    // Check if content is an IPFS hash
    const isHash = delulu.content.startsWith("Qm") || 
      (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
    return !isHash;
  };

  // Filter delulus based on active tab and content loading status
  const filteredDelulus = useMemo(() => {
    let delulusToFilter: FormattedDelulu[] = [];
    
    if (activeTab === "vision") {
      // For Vision tab, show delulus created by the connected user
      if (!isConnected || !address) {
        return [];
      }
      delulusToFilter = userCreatedDelulus;
    } else {
      // For "For You" tab, show all delulus (sorted by latest first)
      delulusToFilter = delulus;
    }
    
    // Only show delulus with loaded content (wait for IPFS to resolve)
    return delulusToFilter.filter(isContentLoaded);
  }, [delulus, activeTab, userCreatedDelulus, isConnected, address]);


  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen  overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => router.push("/profile")}
            onCreateClick={() => router.push("/board")}
          />
        </div>

        <main 
          ref={scrollContainerRef}
          className="h-screen lg:border-x border-gray-200 overflow-y-auto scrollbar-hide"
        >
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
                  "px-4 h-full flex items-center justify-center text-sm font-bold transition-colors relative",
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
                  "px-4 h-full flex items-center justify-center text-sm font-medium transition-colors relative",
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

          <div className="px-4 lg:px-6 py-6 space-y-6 pb-32 lg:pb-6 pt-20 lg:pt-6">
            {isLoading || (activeTab === "vision" && isLoadingUserDelulus) ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <DeluluCardSkeleton key={i} index={i} />
                ))}
              </div>
            ) : filteredDelulus.length > 0 ? (
              <div className="flex flex-col">
                {filteredDelulus.map((delusion, index) => {
                  return (
                    <DeluluCard
                      key={`delulu-${delusion.onChainId || delusion.id}-${index}`}
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
                {/* Loading indicator for next page */}
                {isFetchingNextPage && (
                  <div className="flex flex-col gap-3 mt-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <DeluluCardSkeleton key={`loading-${i}`} index={i} />
                    ))}
                  </div>
                )}
                {/* End of feed message */}
                {!hasNextPage && filteredDelulus.length > 0 && activeTab === "fyp" && (
                  <div className="text-center py-8 mt-4">
                    <p className="text-gray-500 text-sm">
                      You&apos;ve reached the end of the feed
                    </p>
                  </div>
                )}
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
          router.push("/");
        }}
      />

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />
    </div>
  );
}
