"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { StakeFlowSheet } from "@/components/stake-flow-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useAllDelulus, useGraphUserDelulus } from "@/hooks/graph";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { useQuery } from "@apollo/client/react";
import { GetDelulusDocument, type GetDelulusQuery, type GetDelulusQueryVariables } from "@/generated/graphql";
import type { FormattedDelulu } from "@/lib/types";
import { Plus } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { UserSetupModal } from "@/components/user-setup-modal";

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { logout, authenticated } = usePrivy();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const { updateUsername, updateAddress, user } = useUserStore();
  const { 
    delulus, 
    isLoading, 
    isFetchingNextPage, 
    isIpfsLoading,
    hasNextPage, 
    fetchNextPage 
  } = useAllDelulus();
  
  const { 
    delulus: userCreatedDelulus, 
    isLoading: isLoadingUserDelulus 
  } = useGraphUserDelulus("ongoing");



  const { username: onChainUsername, isLoading: isLoadingUsername } = useUsernameByAddress(
    address as `0x${string}` | undefined
  );

  // Update store when username is fetched from contract
  useEffect(() => {
    if (address && onChainUsername && onChainUsername !== user?.username) {
      updateUsername(onChainUsername, user?.email);
    }
    // Also update address if it's not set
    if (address && address !== user?.address) {
      updateAddress(address);
    }
  }, [address, onChainUsername, user?.username, user?.email, user?.address, updateUsername, updateAddress]);

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
  const [activeTab, setActiveTab] = useState<"board" | "fyp">("board");
  const [isScrolling, setIsScrolling] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
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

  // After a fresh Privy login, prompt user to set up profile only if username is not set
  useEffect(() => {
    if (!authenticated) return;
    if (user?.username) {
      setShowUserSetupModal(false);
      return;
    }
    setShowUserSetupModal(true);
  }, [authenticated, user?.username]);


  // Helper to check if content is loaded (not a hash)
  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    // Check if content is an IPFS hash
    const isHash = delulu.content.startsWith("Qm") || 
      (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
    return !isHash;
  };

  const filteredDelulus = useMemo(() => {
    let delulusToFilter: FormattedDelulu[] = [];
    
    if (activeTab === "board") {
      if (!isConnected || !address) {
        return [];
      }
      delulusToFilter = userCreatedDelulus;
    } else {
      delulusToFilter = delulus;
    }
    
    return delulusToFilter.filter(isContentLoaded);
  }, [delulus, activeTab, userCreatedDelulus, isConnected, address]);

  return (
    <div className="h-screen  overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_360px] h-screen">
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

        <main 
          ref={scrollContainerRef}
          className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background"
        >
          <div className="lg:hidden">
            <Navbar
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
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          <div className="hidden lg:block sticky top-0 z-30 bg-secondary/95 backdrop-blur-sm border-b border-border">
            <div className="flex items-center justify-center gap-1 h-14">
              <button
                onClick={() => setActiveTab("board")}
                className={cn(
                  "px-4 h-full flex items-center justify-center text-sm font-bold transition-colors relative",
                  activeTab === "board"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Board
                {activeTab === "board" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-foreground rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("fyp")}
                className={cn(
                  "px-4 h-full flex items-center justify-center text-sm font-medium transition-colors relative",
                  activeTab === "fyp"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                For you
                {activeTab === "fyp" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-foreground rounded-full" />
                )}
              </button>

            </div>

            
          </div>

          <div className="px-4 lg:px-6 py-6 space-y-6 pb-32 lg:pb-6 pt-20 lg:pt-6">
            {(activeTab === "fyp" && (isLoading || isIpfsLoading)) ||
            (activeTab === "board" && isLoadingUserDelulus) ? (
              <div className={activeTab === "board" ? "columns-1 gap-3 space-y-3" : "flex flex-col gap-3"}>
                {Array.from({ length: activeTab === "board" ? 6 : 5 }).map((_, i) => (
                  activeTab === "board" ? (
                    <div
                      key={i}
                      className="break-inside-avoid mb-3 aspect-[16/9] bg-muted rounded-xl border border-border animate-pulse"
                    />
                  ) : (
                    <DeluluCardSkeleton key={i} index={i} />
                  )
                ))}
              </div>
            ) : filteredDelulus.length > 0 ? (
              <div className={activeTab === "board" ? "columns-1 gap-3 space-y-3" : "flex flex-col"}>
                {filteredDelulus.map((delusion, index) => {
                  const commonProps = {
                    key: `delulu-${delusion.onChainId || delusion.id}-${index}`,
                    delusion,
                    href: `/delulu/${delusion.id}`,
                    onStake: () => {
                      if (!isConnected) {
                        setShowLoginSheet(true);
                      } else {
                        setSelectedDelulu(delusion);
                        setStakingSheetOpen(true);
                      }
                    },
                    isLast: index === filteredDelulus.length - 1,
                  };

                  return activeTab === "board" ? (
                    <div key={commonProps.key} className="break-inside-avoid mb-3">
                      <ProfileDeluluCard {...commonProps} size="masonry" />
                    </div>
                  ) : (
                    <DeluluCard {...commonProps} />
                  );
                })}
                {/* Loading indicator for next page */}
                {isFetchingNextPage && (
                  <div className={activeTab === "board" ? "columns-1 gap-3 space-y-3 mt-6" : "flex flex-col gap-3 mt-6"}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      activeTab === "board" ? (
                        <div
                          key={`loading-${i}`}
                          className="break-inside-avoid mb-3 aspect-[16/9] bg-muted rounded-xl border border-border animate-pulse"
                        />
                      ) : (
                        <DeluluCardSkeleton key={`loading-${i}`} index={i} />
                      )
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
              <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
                {activeTab === "board" ? (
                  <>
                    <p className="text-muted-foreground text-sm mb-2">
                      Your board is empty
                    </p>
                    <p className="text-muted-foreground/70 text-xs mb-6 max-w-sm">
                      Create your first delulu to start building your board
                    </p>
                    <button
                      onClick={() => {
                        if (!isConnected) {
                          setShowLoginSheet(true);
                        } else {
                          router.push("/board");
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-secondary bg-secondary text-foreground shadow-[3px_3px_0px_0px_#1A1A1A] hover:shadow-[4px_4px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all text-sm font-bold"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Create Delulu
                    </button>
                  </>
                ) : (
                  <>
                <p className="text-gray-500 text-sm">
                      No delulus yet
                </p>
                <p className="text-gray-400 text-xs mt-1">
                      Start by creating your first delulu
                </p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

     
      <button
        onClick={() => {
          if (!isConnected) {
            setShowLoginSheet(true);
          } else {
            router.push("/board");
          }
        }}
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

      <StakeFlowSheet
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
          logout();
          setLogoutSheetOpen(false);
          router.push("/");
        }}
      />

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />

      <UserSetupModal
        open={showUserSetupModal && !user?.username}
        onOpenChange={setShowUserSetupModal}
        onComplete={(username, email) => {
          updateUsername(username, email);
          setShowUserSetupModal(false);
        }}
      />
    </div>
  );
}
