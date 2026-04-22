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
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useAllDelulus } from "@/hooks/graph";
import type { FormattedDeluluFeed } from "@/hooks/graph/useAllDelulus";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import type { FormattedDelulu } from "@/lib/types";
import { Plus } from "lucide-react";
import Link from "next/link";
import { UserSetupModal } from "@/components/user-setup-modal";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ContinueJourneyCard } from "@/components/continue-journey-card";

function BoardTile({
  delusion,
  pfpUrl,
}: {
  delusion: FormattedDelulu;
  pfpUrl?: string | null;
}) {
  const addrHex = delusion.creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(addrHex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  const gradient = `linear-gradient(140deg, hsl(${h1},50%,22%) 0%, hsl(${h2},55%,13%) 100%)`;
  const headline = delusion.content?.trim() || "YOUR DELULU HEADLINE";
  const minH = headline.length > 80 ? 380 : headline.length > 40 ? 320 : 260;

  const displayName = delusion.username
    ? `@${delusion.username}`
    : `${delusion.creator.slice(0, 6)}…${delusion.creator.slice(-4)}`;

  return (
    <Link href={`/delulu/${delusion.id}`} className="block break-inside-avoid mb-3">
      <div
        className="relative rounded-2xl overflow-hidden flex flex-col justify-end hover:scale-[1.02] hover:shadow-xl transition-all duration-200 cursor-pointer"
        style={{ background: gradient, minHeight: minH }}
      >
        {delusion.bgImageUrl && (
          <img
            src={delusion.bgImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
        <div className="relative px-3 pb-3 pt-10">
          <p
            className="text-white font-bold text-sm leading-snug line-clamp-4 mb-3"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            {headline}
          </p>
          {/* Pinterest-style creator row */}
          <div className="flex items-center gap-1.5">
            <UserAvatar
              address={delusion.creator}
              username={delusion.username}
              pfpUrl={pfpUrl}
              size={20}
            />
            <span className="text-white/70 text-[11px] font-medium truncate">
              {displayName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { isConnected, address, authenticated, logout } = useAuth();

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
    isIpfsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchFeed,
  } = useAllDelulus();
  



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
  const [activeTab, setActiveTab] = useState<"board" | "fyp">(() => {
    try {
      const saved = localStorage.getItem("delulu_feed_tab");
      if (saved === "board" || saved === "fyp") return saved;
    } catch {}
    return "fyp";
  });

  const handleTabChange = (tab: "board" | "fyp") => {
    setActiveTab(tab);
    try { localStorage.setItem("delulu_feed_tab", tab); } catch {}
  };
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [feedNowMs, setFeedNowMs] = useState(() => Date.now());

  const scrollContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < 400 && hasNextPage && !isFetchingNextPage && !isLoading) {
        fetchNextPage();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

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
    return delulus.filter(isContentLoaded);
  }, [delulus]);

  const creatorAddresses = useMemo(
    () => Array.from(new Set(filteredDelulus.map((d) => d.creator.toLowerCase()))),
    [filteredDelulus],
  );
  const creatorPfps = usePfps(creatorAddresses);

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
          {/* Indeterminate progress bar — visible during any fetch */}
          <div className="sticky top-0 z-50 h-[2px] w-full overflow-hidden pointer-events-none">
            {(isLoading || isFetchingNextPage) && (
              <div className="absolute inset-0 bg-border/30">
                <div className="h-full w-1/3 bg-delulu-green animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full" />
              </div>
            )}
          </div>
          <div className="lg:hidden">
            <Navbar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onSearchClick={() => {
                if (!authenticated) router.push("/sign-in");
                else router.push("/search");
              }}
            />
          </div>

          <div className="hidden lg:block sticky top-0 z-30 bg-secondary/95 backdrop-blur-sm border-b border-border">
            <div className="flex items-center justify-center gap-1 h-14">
              <button
                onClick={() => handleTabChange("board")}
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
                onClick={() => handleTabChange("fyp")}
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

          <div className="px-4 lg:px-6 pb-20 lg:pb-6 pt-20 lg:pt-6">
            {/* Continue Journey card — shown to connected users with an active series */}
            <ContinueJourneyCard className="mb-4" />

            {isLoading || (isIpfsLoading && filteredDelulus.length === 0) ? (
              activeTab === "board" ? (
                <div className="columns-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="break-inside-avoid mb-3 rounded-2xl bg-muted animate-pulse"
                      style={{ height: [280, 360, 300, 380, 260, 340, 320, 270][i] }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <DeluluCardSkeleton key={i} index={i} />
                  ))}
                </div>
              )
            ) : filteredDelulus.length > 0 ? (
              activeTab === "board" ? (
                <>
                  <div className="columns-2 gap-3">
                    {filteredDelulus.map((delusion, index) => (
                      <BoardTile
                        key={`board-${delusion.onChainId || delusion.id}-${index}`}
                        delusion={delusion}
                        pfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                      />
                    ))}
                    {/* Skeleton tiles appended inline so masonry columns stay balanced */}
                    {isFetchingNextPage && Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={`board-skel-${i}`}
                        className="break-inside-avoid mb-3 rounded-2xl bg-muted animate-pulse"
                        style={{ height: [300, 260, 340, 280][i] }}
                      />
                    ))}
                  </div>
                  {!isFetchingNextPage && !hasNextPage && filteredDelulus.length > 0 && (
                    <p className="text-center text-xs text-muted-foreground/50 py-6">
                      You&apos;ve seen everything
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col">
                  {filteredDelulus.map((delusion, index) => {
                    const feedDelusion = delusion as FormattedDeluluFeed;
                    const itemKey = `delulu-${delusion.onChainId || delusion.id}-${index}`;
                    return (
                      <DeluluCard
                        key={itemKey}
                        delusion={delusion}
                        href={`/delulu/${delusion.id}`}
                        isLast={index === filteredDelulus.length - 1}
                        nowMs={feedNowMs}
                        disableMilestoneQuery
                        disableUsernameLookup
                        feedMilestones={feedDelusion.feedMilestones}
                        totalMilestoneCount={feedDelusion.totalMilestoneCount}
                        creatorPfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                      />
                    );
                  })}
                  {isFetchingNextPage && (
                    <div className="flex flex-col gap-3 mt-1">
                      <DeluluCardSkeleton index={0} />
                      <DeluluCardSkeleton index={1} />
                    </div>
                  )}
                  {!isFetchingNextPage && !hasNextPage && filteredDelulus.length > 0 && (
                    <p className="text-center text-xs text-muted-foreground/50 py-6">
                      You&apos;ve seen everything
                    </p>
                  )}
                </div>
              )
            ) : (
              <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground text-sm">No delulus yet</p>
                <p className="text-muted-foreground/70 text-xs mt-1">Start by creating your first delulu</p>
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
        onLogout={async () => {
          await logout();
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
