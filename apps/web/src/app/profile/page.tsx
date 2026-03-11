"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { StakeFlowSheet } from "@/components/stake-flow-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { formatAddress } from "@/lib/utils";
import { ArrowLeft, LogOut, Coins, Eye, EyeOff, Copy, Check, Plus } from "lucide-react";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { UserClaimsStats } from "@/components/user-claims-stats";
import { cn } from "@/lib/utils";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

type TabType = "ongoing" | "past";

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

export default function ProfilePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, isLoading } = useUserStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("ongoing");
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(
    null
  );
  const [stakingSheetOpen, setStakingSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  // Get username and avatar
  const { username: contractUsername } = useUsernameByAddress(address);
  const displayUsername = contractUsername || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : address
    ? formatAddress(address)
    : "";
  const fallbackAvatarUrl = `${DEFAULT_AVATAR_BASE}${encodeURIComponent(
    creatorLabel
  )}`;
  const avatarUrl = user?.pfpUrl || fallbackAvatarUrl;

  const { formatted: gDollarBalance, isLoading: isBalanceLoading } = useTokenBalance(
    GOODDOLLAR_ADDRESSES.mainnet
  );

  const {
    delulus,
    isLoading: isLoadingDelulus,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useGraphUserDelulus(activeTab);

  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    const isHash = delulu.content.startsWith("Qm") ||
      (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
    return !isHash;
  };

  const delulusWithContent = delulus.filter(isContentLoaded);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current || document.documentElement;
      const scrollTop = container.scrollTop || window.scrollY;
      const scrollHeight =
        container.scrollHeight || document.documentElement.scrollHeight;
      const clientHeight = container.clientHeight || window.innerHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (
        distanceFromBottom < 200 &&
        hasNextPage &&
        !isFetchingNextPage &&
        !isLoadingDelulus
      ) {
        fetchNextPage();
      }
    };

    const container = scrollContainerRef.current || window;
    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [hasNextPage, isFetchingNextPage, isLoadingDelulus, fetchNextPage]);

  useEffect(() => {
    if (!isConnected && !showLoginSheet) {
      setShowLoginSheet(true);
    }
  }, [isConnected, showLoginSheet]);

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        <div
          ref={scrollContainerRef}
          className="relative h-screen flex flex-col overflow-y-auto scrollbar-hide"
        >
          {/* Compact Header */}
          <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <button
                onClick={() => router.back()}
                className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

        

              <button
                onClick={() => setLogoutSheetOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                title="Disconnect"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Profile Header - Twitter Style */}
          {address && (
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
                    <img
                      src={avatarUrl}
                      alt={displayUsername || formatAddress(address)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = fallbackAvatarUrl;
                      }}
                    />
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h1 className="text-xl capitalize font-bold text-foreground">
                      {displayUsername || formatAddress(address)}
                    </h1>
                    <button
                      onClick={() => router.push("/board")}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90 transition-colors text-sm font-semibold flex-shrink-0"
                      title="Create delulu"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Manifest</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground mb-3">
                    <button
                      onClick={handleCopyAddress}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Copy address"
                    >
                      <span>{formatAddress(address)}</span>
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {showBalance && !isBalanceLoading && (
                      <div className="flex items-center gap-1">
                        <TokenBadge tokenAddress={GOODDOLLAR_ADDRESSES.mainnet} size="sm" showText={false} />
                        <span className="font-medium">{parseFloat(gDollarBalance).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-sm">
                    <UserClaimsStats address={address} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          {address && (
            <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm">
              <div className="flex items-center px-4 border-b border-border">
                <button
                  onClick={() => setActiveTab("ongoing")}
                  className={cn(
                    "flex-1 py-3 text-sm font-semibold transition-colors relative",
                    activeTab === "ongoing"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Ongoing
                  {activeTab === "ongoing" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("past")}
                  className={cn(
                    "flex-1 py-3 text-sm font-semibold transition-colors relative",
                    activeTab === "past"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Past
                  {activeTab === "past" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Claim UBI - Compact */}
          {address && (
            <div className="px-4 pt-3 pb-2">
              <Link
                href="/daily-claim"
                className="flex items-center justify-between py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <img
                    src="/gooddollar-logo.png"
                    alt="G$"
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground group-hover:text-delulu-yellow-reserved transition-colors">
                    Claim G$ UBI
                  </span>
                </div>
                <Coins className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>
          )}

          {/* Delulu Grid */}
          {address && (
            <div className="px-4 py-4">
              {isLoadingDelulus ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="w-full aspect-[3/4] bg-muted rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : delulusWithContent.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    No {activeTab === "ongoing" ? "ongoing" : "past"} delulus yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeTab === "ongoing"
                      ? "Create your first delulu to get started!"
                      : "Completed delulus will appear here."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {delulusWithContent.map((delulu) => (
                      <ProfileDeluluCard
                        key={delulu.id}
                        delusion={delulu}
                        onClick={() => {
                          router.push(`/delulu/${delulu.id}`);
                        }}
                        onStake={() => {
                          setSelectedDelulu(delulu);
                          setStakingSheetOpen(true);
                        }}
                      />
                    ))}
                  </div>

                  {isFetchingNextPage && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={`loading-${i}`}
                          className="w-full aspect-[3/4] bg-muted rounded-lg animate-pulse"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
          setLogoutSheetOpen(false);
          router.push("/");
        }}
      />

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={(open) => {
          setShowLoginSheet(open);
          if (!open && !isConnected) {
            router.back();
          }
        }}
      />
    </div>
  );
}
