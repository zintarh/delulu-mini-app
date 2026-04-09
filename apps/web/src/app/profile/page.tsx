"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect, useBalance } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserDelulus } from "@/hooks/graph";
import { LogoutSheet } from "@/components/logout-sheet";
import { formatAddress } from "@/lib/utils";
import {
  LogOut,
  Copy,
  Check,
  Plus,
  Trophy,
  Camera,
  Loader2,
} from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { BottomNav } from "@/components/bottom-nav";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { UserClaimsStats } from "@/components/user-claims-stats";
import { cn } from "@/lib/utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { PushRemindersCard } from "@/components/pwa/PushRemindersCard";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";

type TabType = "ongoing" | "past";

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

export default function ProfilePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { logout } = usePrivy();
  const { user } = useUserStore();
  const router = useRouter();

  const handleProfileClick = () => {};
  const handleCreateClick = () => {
    if (!isConnected) router.push("/sign-in");
    else router.push("/board");
  };

  const [activeTab, setActiveTab] = useState<TabType>("ongoing");
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isUploading: isPfpUploading, inputRef: pfpInputRef, openPicker: openPfpPicker, onFileChange: onPfpFileChange } = usePfpUpload();

  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : address
    ? formatAddress(address)
    : "";
  const fallbackAvatarUrl = `${DEFAULT_AVATAR_BASE}${encodeURIComponent(creatorLabel)}`;
  const avatarUrl = user?.pfpUrl || fallbackAvatarUrl;

  const { formatted: gDollarBalance, isLoading: isBalanceLoading } =
    useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);

  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const {
    delulus,
    isLoading: isLoadingDelulus,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useGraphUserDelulus("past");

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage && !isLoadingDelulus) {
        fetchNextPage();
      }
    };
    const el = scrollContainerRef.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, isLoadingDelulus, fetchNextPage]);

  useEffect(() => {
    if (!isConnected) router.replace("/sign-in");
  }, [isConnected, router]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[250px_1fr_320px] h-screen">

        {/* ── Left sidebar ───────────────────────────────────────── */}
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={handleProfileClick}
            onCreateClick={handleCreateClick}
          />
        </div>

        {/* ── Main content ───────────────────────────────────────── */}
        <main className="h-screen lg:border-x border-border overflow-y-auto scrollbar-hide bg-background" ref={scrollContainerRef}>
          {address && (
            <>
              {/* ── Profile header ─────────────────────────────── */}
              <div className="px-4 pt-6 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-4 mb-4">
                  {/* Avatar */}
                  <button
                    type="button"
                    onClick={openPfpPicker}
                    disabled={isPfpUploading}
                    className="relative w-16 h-16 rounded-full flex-shrink-0 bg-muted ring-2 ring-border overflow-hidden group"
                  >
                    <img
                      src={avatarUrl}
                      alt={displayUsername || formatAddress(address)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackAvatarUrl;
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPfpUploading
                        ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                        : <Camera className="w-5 h-5 text-white" />
                      }
                    </div>
                  </button>
                  <input
                    ref={pfpInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPfpFileChange}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push("/board")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#fcff52] text-[#111111] font-bold text-sm shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#1A1A1A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Manifest
                    </button>
                    <button
                      onClick={() => setLogoutSheetOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Name + handle */}
                <h1 className="text-xl font-bold text-foreground capitalize leading-tight">
                  {displayUsername || formatAddress(address)}
                </h1>
                {displayUsername && (
                  <p className="text-sm text-muted-foreground">@{displayUsername}</p>
                )}

                {/* Wallet address */}
                <button
                  onClick={handleCopyAddress}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-mono">{formatAddress(address)}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-[#35d07f]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                {/* Balance chips */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {!isCeloLoading && celoBalance && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
                      <img src="/celo.png" alt="CELO" className="h-3.5 w-3.5 rounded-full" />
                      {parseFloat(celoBalance.formatted).toFixed(3)}{" "}
                      <span className="text-muted-foreground">CELO</span>
                    </span>
                  )}
                  {!isBalanceLoading && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground">
                      <TokenBadge tokenAddress={GOODDOLLAR_ADDRESSES.mainnet} size="sm" showText={false} />
                      {parseFloat(gDollarBalance).toFixed(2)}{" "}
                      <span className="text-muted-foreground">G$</span>
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-5 mt-3">
                  <UserClaimsStats address={address} />
                </div>
              </div>

              {/* ── Quick links ──────────────────────────────────── */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                <Link
                  href="/daily-claim"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  <img src="/gooddollar-logo.png" alt="G$" className="w-3.5 h-3.5 object-contain" />
                  Claim G$ UBI
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5 text-[#fcff52]" />
                  Leaderboard
                </Link>
              </div>

              {/* ── Push reminders ───────────────────────────────── */}
              <div className="px-4 py-3 border-b border-border">
                <PushRemindersCard />
              </div>

              {/* ── Tabs ─────────────────────────────────────────── */}
              <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="flex items-center">
                  {(["ongoing", "past"] as TabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-3.5 text-sm font-semibold capitalize relative transition-colors",
                        activeTab === tab
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                      {activeTab === tab && (
                        <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] rounded-full bg-[#fcff52]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab content ──────────────────────────────────── */}
              {activeTab === "ongoing" ? (
                <div className="pb-24 lg:pb-8">
                  <OngoingMilestonesSection onCreateClick={() => router.push("/board")} />
                </div>
              ) : (
                <div className="px-4 py-4 pb-24 lg:pb-8">
                  {isLoadingDelulus ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="w-full aspect-[3/4] bg-muted rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : delulus.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        No past delulus yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Completed delulus will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {delulus.map((delulu) => (
                          <ProfileDeluluCard
                            key={delulu.id}
                            delusion={delulu}
                            onClick={() => router.push(`/delulu/${delulu.id}`)}
                          />
                        ))}
                      </div>
                      {isFetchingNextPage && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                          {[1, 2, 3].map((i) => (
                            <div key={`loading-${i}`} className="w-full aspect-[3/4] bg-muted rounded-xl animate-pulse" />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Right sidebar ──────────────────────────────────────── */}
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <BottomNav
        onProfileClick={handleProfileClick}
        onCreateClick={handleCreateClick}
      />

      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={async () => {
          await logout();
          await disconnect();
          setLogoutSheetOpen(false);
          useUserStore.getState().logout();
          router.push("/sign-in");
        }}
      />

    </div>
  );
}
