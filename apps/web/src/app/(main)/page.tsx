"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { HomeFeedExplore } from "@/components/home-feed-explore";
import { buildFeedCategories } from "@/lib/feed-categories";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { useAllDelulus } from "@/hooks/graph";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import type { FormattedDelulu } from "@/lib/types";
import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";

const ClaimRewardsSheet = dynamic(
  () =>
    import("@/components/claim-rewards-sheet").then((m) => m.ClaimRewardsSheet),
  { ssr: false },
);
const UserSetupModal = dynamic(
  () => import("@/components/user-setup-modal").then((m) => m.UserSetupModal),
  { ssr: false },
);

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
  const coverImageSrc = normalizeDeluluImageSrc(delusion.bgImageUrl);

  return (
    <Link href={`/delulu/${delusion.id}`} className="block break-inside-avoid mb-2 lg:mb-3">
      <div
        className="relative rounded-2xl overflow-hidden flex flex-col justify-end hover:brightness-90 transition-all duration-200 cursor-pointer"
        style={{ background: gradient, minHeight: minH }}
      >
        {coverImageSrc && (
          <Image
            src={coverImageSrc}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        <div className="relative px-3 pb-3 pt-10">
          <p
            className="text-white font-bold text-sm leading-snug line-clamp-4 mb-2.5"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            {headline}
          </p>
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
  const { isConnected, address, authenticated } = useAuth();
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

  const { username: onChainUsername } = useUsernameByAddress(
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
  const [feedNowMs, setFeedNowMs] = useState(() => Date.now());
  const scrollContainerRef = useRef<HTMLElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for infinite scroll — no per-frame scroll handler needed
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  useEffect(() => {
    const id = setInterval(() => setFeedNowMs(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setFeedNowMs(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    if (!authenticated || !isProfileLoaded) return;
    if (user?.username) { setShowUserSetupModal(false); return; }
    try {
      if (window.localStorage.getItem("delulu_profile_setup_suppressed_v1") === "1") return;
    } catch {}
    setShowUserSetupModal(true);
  }, [authenticated, isProfileLoaded, user?.username]);

  useEffect(() => {
    const onCreated = () => refetchFeed();
    if (typeof window !== "undefined") window.addEventListener("delulu:created", onCreated);
    return () => { if (typeof window !== "undefined") window.removeEventListener("delulu:created", onCreated); };
  }, [refetchFeed]);

  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    const isHash = delulu.content.startsWith("Qm") ||
      (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
    return !isHash;
  };

  const filteredDelulus = useMemo(() => delulus.filter(isContentLoaded), [delulus]);

  const feedCategories = useMemo(
    () => buildFeedCategories(filteredDelulus, address),
    [filteredDelulus, address],
  );

  const creatorAddresses = useMemo(
    () => Array.from(new Set(filteredDelulus.map((d) => d.creator.toLowerCase()))),
    [filteredDelulus],
  );
  const creatorPfps = usePfps(creatorAddresses);

  return (
    <>
      <main
          ref={scrollContainerRef}
          className="h-screen overflow-y-auto scrollbar-hide bg-background"
          style={{ touchAction: "pan-y" }}
        >
          {/* Indeterminate progress bar */}
          <div className="sticky top-0 z-50 h-[2px] w-full overflow-hidden pointer-events-none">
            {(isLoading || isFetchingNextPage) && (
              <div className="absolute inset-0 bg-border/30">
                <div className="h-full w-1/3 bg-delulu-blue animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full" />
              </div>
            )}
          </div>

          {/* Mobile navbar */}
          <div className="lg:hidden">
            <Navbar />
          </div>

          {/* Desktop header: Pinterest-style search + profile + pill tabs */}
          <div className="hidden lg:block sticky top-0 z-30 overflow-visible bg-background/95 backdrop-blur-md">
            {/* Row 1: Search + Profile */}
            <div className="flex items-center gap-4 px-6 py-4">
              <HomeSearch variant="hero" className="flex-1" />
              <NavbarProfileMenu />
            </div>

            {/* Row 2: Pill tabs — commented out, bring back later */}
            {/* <div className="flex items-center gap-2 px-6 pb-3">
              <button
                onClick={() => handleTabChange("fyp")}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                  activeTab === "fyp"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                For You
              </button>
              <button
                onClick={() => handleTabChange("board")}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                  activeTab === "board"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Challenges
              </button>
            </div> */}
          </div>

          {/* Feed — categorized rows (mobile + desktop For You); Board tab on desktop */}
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-[4.5rem] sm:px-6 lg:px-10 lg:pb-12 lg:pt-6">
            {isLoading || (isIpfsLoading && filteredDelulus.length === 0) ? (
              <>
                <div className={cn(activeTab === "board" && "lg:hidden")}>
                  <HomeFeedExplore
                    categories={feedCategories}
                    isLoading
                    creatorPfps={{}}
                  />
                </div>
                {activeTab === "board" ? (
                  <div className="hidden lg:block">
                    <div className="columns-2 lg:columns-3 gap-2 lg:gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="break-inside-avoid mb-2 lg:mb-3 rounded-2xl bg-muted animate-pulse"
                      style={{ height: [280, 360, 300, 380, 260, 340, 320, 270, 300, 250, 380, 310][i] }}
                    />
                  ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : filteredDelulus.length > 0 ? (
              <>
                <HomeFeedExplore
                  className={cn(activeTab === "board" && "lg:hidden")}
                  categories={feedCategories}
                  nowMs={feedNowMs}
                  creatorPfps={creatorPfps}
                />

                {activeTab === "board" ? (
                  <div className="hidden lg:block">
                    <div className="columns-2 lg:columns-3 gap-2 lg:gap-3">
                      {filteredDelulus.map((delusion, index) => (
                        <BoardTile
                          key={`board-${delusion.onChainId || delusion.id}-${index}`}
                          delusion={delusion}
                          pfpUrl={creatorPfps[delusion.creator.toLowerCase()]}
                        />
                      ))}
                      {isFetchingNextPage &&
                        Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`board-skel-${i}`}
                            className="break-inside-avoid mb-2 lg:mb-3 rounded-2xl bg-muted animate-pulse"
                            style={{ height: [300, 260, 340, 280, 320, 260][i] }}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground text-sm">No delulus yet</p>
                <p className="text-muted-foreground/70 text-xs mt-1">Start by creating your first delulu</p>
              </div>
            )}
          </div>
          {/* Sentinel for IntersectionObserver-based infinite scroll */}
          <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden />
      </main>

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />

      <UserSetupModal
        open={showUserSetupModal && !user?.username}
        onOpenChange={(open) => {
          setShowUserSetupModal(open);
          if (!open && typeof window !== "undefined") {
            try { window.localStorage.setItem("delulu_profile_setup_suppressed_v1", "1"); } catch {}
          }
        }}
        onComplete={(username, email) => {
          updateUsername(username, email);
          setShowUserSetupModal(false);
          if (typeof window !== "undefined") {
            try { window.localStorage.setItem("delulu_profile_setup_suppressed_v1", "1"); } catch {}
          }
        }}
      />
    </>
  );
}
