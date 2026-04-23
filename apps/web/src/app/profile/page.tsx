"use client";
import React, { useState, useEffect, useRef } from "react";
import { useBalance } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
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
  Send,
} from "lucide-react";
import { usePfpUpload } from "@/hooks/use-pfp-upload";
import { usePfp } from "@/hooks/use-profile-pfp";
import { DeluluCard } from "@/components/delulu-card";
import { BottomNav } from "@/components/bottom-nav";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { cn } from "@/lib/utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { OngoingMilestonesSection } from "@/components/ongoing-milestones-section";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { ContinueJourneyCard } from "@/components/continue-journey-card";

type TabType = "milestones" | "active" | "ended";


export default function ProfilePage() {
  const { isConnected, address, logout } = useAuth();
  const { user, updateProfile } = useUserStore();
  const router = useRouter();

  const handleProfileClick = () => {};
  const handleCreateClick = () => {
    if (!isConnected) router.push("/sign-in");
    else router.push("/board");
  };

  const [activeTab, setActiveTab] = useState<TabType>("milestones");
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isUploading: isPfpUploading, upload: uploadPfp, inputRef: pfpInputRef, openPicker: openPfpPicker } = usePfpUpload();
  const [uploadToast, setUploadToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || null;
  // Always fetch live from Supabase — Zustand store only has pfp if set in current session
  const pfpFromSupabase = usePfp(address);
  // pfpFromSupabase: undefined = loading, null = no pfp, string = url
  // Fall back to store value (set optimistically on upload) while Supabase is loading
  const avatarUrl = (pfpFromSupabase !== undefined ? pfpFromSupabase : user?.pfpUrl) || null;

  const { formatted: gDollarBalance, isLoading: isBalanceLoading } =
    useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);

  const { data: celoBalance, isLoading: isCeloLoading } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const {
    delulus: ongoingDelulus,
    isLoading: isLoadingOngoing,
  } = useGraphUserDelulus("ongoing");

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

  useEffect(() => {
    if (!uploadToast) return;
    const timer = setTimeout(() => setUploadToast(null), 2500);
    return () => clearTimeout(timer);
  }, [uploadToast]);

  const handlePfpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const previousPfp = user?.pfpUrl;
    const previewUrl = URL.createObjectURL(file);

    // Optimistic UI: show new image immediately while upload runs.
    updateProfile({ pfpUrl: previewUrl });

    try {
      await uploadPfp(file);
      setUploadToast({ type: "success", message: "Profile photo updated" });
    } catch (err: any) {
      updateProfile({ pfpUrl: previousPfp });
      setUploadToast({
        type: "error",
        message: err?.message ?? "Failed to update profile photo",
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

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
                    {pfpFromSupabase === undefined && !user?.pfpUrl ? (
                      /* Loading skeleton */
                      <div className="w-full h-full bg-muted animate-pulse rounded-full" />
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayUsername || formatAddress(address)}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      /* No pfp — initials */
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold bg-muted text-muted-foreground">
                        {(displayUsername || address || "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
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
                    onChange={handlePfpFileChange}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push("/board")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted transition-colors"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      <Plus className="w-4 h-4" />
                      Manifest
                    </button>
                    <button
                      onClick={() => setLogoutSheetOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Name + handle */}
                <h1
                  className="text-xl font-bold text-foreground capitalize leading-tight"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  {displayUsername || formatAddress(address)}
                </h1>
                {displayUsername && (
                  <p
                    className="text-sm text-muted-foreground"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    @{displayUsername}
                  </p>
                )}

                {/* Wallet address */}
                <button
                  onClick={handleCopyAddress}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
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

              </div>

              {/* ── Quick links ──────────────────────────────────── */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                <Link
                  href="/daily-claim"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  <img src="/gooddollar-logo.png" alt="G$" className="w-3.5 h-3.5 object-contain" />
                  Claim G$ UBI
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                  Leaderboard
                </Link>
                <a
                  href={TG_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  <Send className="w-3.5 h-3.5 text-[#35d07f]" />
                  Join TG
                </a>
              </div>

              {/* ── Journey card ─────────────────────────────────── */}
              <div className="px-4 py-3 border-b border-border">
                <ContinueJourneyCard />
              </div>

              {/* ── Tabs ─────────────────────────────────────────── */}
              <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
                <div className="flex items-center gap-1 p-1 rounded-full bg-muted/20 border border-border/40">
                  {(["milestones", "active", "ended"] as TabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-1.5 rounded-full text-xs font-semibold capitalize transition-all",
                        activeTab === tab
                          ? "bg-card text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      )}
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab content ──────────────────────────────────── */}

              {/* Milestones */}
              {activeTab === "milestones" && (
                <div className="pb-24 lg:pb-8">
                  <OngoingMilestonesSection onCreateClick={() => router.push("/board")} />
                </div>
              )}

              {/* Active */}
              {activeTab === "active" && (
                <div className="px-4 pt-4 pb-24 lg:pb-8">
                  {isLoadingOngoing ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-full h-52 bg-muted rounded-2xl animate-pulse"
                        />
                      ))}
                    </div>
                  ) : ongoingDelulus.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p
                        className="text-sm font-semibold text-foreground mb-1"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        No active delulu
                      </p>
                      <p
                        className="text-xs text-muted-foreground mb-5"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Start manifesting something new.
                      </p>
                      <button
                        onClick={() => router.push("/board")}
                        className="px-5 py-2.5 rounded-full border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted transition-colors"
                        style={{ fontFamily: "var(--font-manrope)" }}
                      >
                        Create a delulu
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ongoingDelulus.map((d) => (
                        <DeluluCard
                          key={d.id}
                          delusion={d}
                          href={`/delulu/${d.id}`}
                          className="mb-0"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ended */}
              {activeTab === "ended" && (
                <div className="px-4 py-4 pb-24 lg:pb-8">
                  {isLoadingDelulus ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="w-full h-52 bg-muted rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : delulus.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p
                        className="text-sm font-semibold text-foreground mb-1"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        No ended delulu yet
                      </p>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                        Ended and resolved delulu will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {delulus.map((delulu) => (
                          <DeluluCard
                            key={delulu.id}
                            delusion={delulu}
                            href={`/delulu/${delulu.id}`}
                            className="mb-0"
                          />
                        ))}
                      </div>
                      {isFetchingNextPage && (
                        <div className="space-y-3 mt-3">
                          {[1, 2].map((i) => (
                            <div key={`loading-${i}`} className="w-full h-52 bg-muted rounded-2xl animate-pulse" />
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
          setLogoutSheetOpen(false);
          useUserStore.getState().logout();
          router.push("/sign-in");
        }}
      />

      {uploadToast && (
        <div className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2">
          <div
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold shadow-lg",
              uploadToast.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
            )}
          >
            {uploadToast.message}
          </div>
        </div>
      )}

    </div>
  );
}
