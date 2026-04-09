"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LeftSidebar } from "@/components/left-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { RightSidebar } from "@/components/right-sidebar";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useAllDelulus, useGraphUserDelulus } from "@/hooks/graph";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import type { FormattedDelulu } from "@/lib/types";
import { Plus } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { UserSetupModal } from "@/components/user-setup-modal";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { logout,  authenticated } = usePrivy();

  const handleProfileClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/profile");
  };
  const handleCreateClick = () => {
    if (!authenticated) router.push("/sign-in");
    else router.push("/board");
  };
  const router = useRouter();
  const { updateUsername, updateAddress, user, isProfileLoaded } = useUserStore();
  const { 
    delulus, 
    isLoading, 
    isFetchingNextPage, 
    hasNextPage, 
    fetchNextPage,
    refetch: refetchFeed,
  } = useAllDelulus();
  
  const { 
    delulus: userCreatedDelulus, 
    isLoading: isLoadingUserDelulus 
  } = useGraphUserDelulus("ongoing");



  const { username: onChainUsername, isLoading: isLoadingUsername } = useUsernameByAddress(
    address as `0x${string}` | undefined
  );

  useEffect(() => {
    if (address && onChainUsername && onChainUsername !== user?.username) {
      updateUsername(onChainUsername, user?.email);
    }
    if (address && address !== user?.address) {
      updateAddress(address);
    }
  }, [address, onChainUsername, user?.username, user?.email, user?.address, updateUsername, updateAddress]);

  const [howItWorksSheetOpen, setHowItWorksSheetOpen] = useState(false);

  const [howItWorksType, setHowItWorksType] = useState<
    "concept" | "market" | "conviction"
  >("concept");

  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [claimRewardsSheetOpen, setClaimRewardsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"board" | "fyp">("fyp");
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [feedNowMs, setFeedNowMs] = useState(() => Date.now());

  const scrollContainerRef = useRef<HTMLElement>(null);

  const { data: onboardingUsername, isLoading: isCheckingOnboarding } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!isConnected && !!address },
  });

  // Contract-only onboarding gate.
  useEffect(() => {
    if (!isConnected || !address) {
      setOnboardingChecked(true);
      return;
    }
    if (isCheckingOnboarding) {
      setOnboardingChecked(false);
      return;
    }
    const hasUsername =
      typeof onboardingUsername === "string" && onboardingUsername.trim().length > 0;
    if (!hasUsername) {
      router.replace("/welcome");
      return;
    }
    setOnboardingChecked(true);
  }, [isConnected, address, isCheckingOnboarding, onboardingUsername, router]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (
        distanceFromBottom < 400 &&
        hasNextPage &&
        !isFetchingNextPage &&
        !isLoading &&
        activeTab === "fyp"
      ) {
        fetchNextPage();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, activeTab]);

  useEffect(() => {
    const id = setInterval(() => setFeedNowMs(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setFeedNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    // Wait until both auth and profile fetch have settled
    if (!authenticated || !isProfileLoaded) return;
    if (user?.username) {
      setShowUserSetupModal(false);
      return;
    }
    try {
      if (window.localStorage.getItem("delulu_profile_setup_suppressed_v1") === "1") return;
    } catch {}
    setShowUserSetupModal(true);
  }, [authenticated, isProfileLoaded, user?.username]);

  useEffect(() => {
    const onCreated = () => {
      refetchFeed();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("delulu:created", onCreated);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("delulu:created", onCreated);
      }
    };
  }, [refetchFeed]);


  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
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

  // Block render until onboarding check resolves — prevents feed flash for new users
  if (!onboardingChecked) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen  overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_360px] h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        <main 
          ref={scrollContainerRef}
          className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background"
        >
          <div className="lg:hidden">
            <Navbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onSearchClick={() => {
                if (!authenticated) router.push("/sign-in");
                else router.push("/search");
              }}
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

          <div className="px-4 lg:px-6 py-6 space-y-6 pb-20 lg:pb-6 pt-20 lg:pt-6">
            {(activeTab === "fyp" && isLoading) ||
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
                  const feedDelusion = delusion as FormattedDeluluFeed;
                  const itemKey = `delulu-${delusion.onChainId || delusion.id}-${index}`;
                  const commonProps = {
                    delusion,
                    href: `/delulu/${delusion.id}`,
                    isLast: index === filteredDelulus.length - 1,
                  };

                  return activeTab === "board" ? (
                    <div key={itemKey} className="break-inside-avoid mb-3">
                      <ProfileDeluluCard key={itemKey} {...commonProps} size="masonry" />
                    </div>
                  ) : (
                    <DeluluCard
                      key={itemKey}
                      {...commonProps}
                      nowMs={feedNowMs}
                      disableMilestoneQuery
                      disableUsernameLookup
                      feedMilestones={feedDelusion.feedMilestones}
                      totalMilestoneCount={feedDelusion.totalMilestoneCount}
                    />
                  );
                })}
                {/* Silent pagination: don't replace cards with skeletons while fetching more. */}
                {activeTab === "fyp" && isFetchingNextPage && (
                  <div className="mt-4 flex items-center justify-center py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <div className="mx-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="sr-only">Loading more</span>
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

      <HowItWorksSheet
        open={howItWorksSheetOpen}
        onOpenChange={setHowItWorksSheetOpen}
        type={howItWorksType}
      />


      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={ async () => {
          await logout();
          await disconnect();

           useUserStore.getState().logout();
          setLogoutSheetOpen(false);
            router.push("/sign-in");
          
        }}
      />

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />


      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <UserSetupModal
        open={showUserSetupModal && !user?.username}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          if (!open && typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                "delulu_profile_setup_suppressed_v1",
                "1",
              );
            } catch {
              // ignore storage errors
            }
          }
        }}
        onComplete={(username, email) => {
          updateUsername(username, email);
          setShowUserSetupModal(false);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                "delulu_profile_setup_suppressed_v1",
                "1",
              );
            } catch {
              // ignore storage errors
            }
          }
        }}
      />
    </div>
  );
}
