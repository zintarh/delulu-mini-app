"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/useUserStore";
import { useGraphUserDelulus } from "@/hooks/graph";
import type { FormattedDelulu } from "@/lib/types";
import { StakeFlowSheet } from "@/components/stake-flow-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { formatAddress } from "@/lib/utils";
import { ArrowLeft, LogOut, Coins } from "lucide-react";
import { ProfileDeluluCard } from "@/components/profile-delulu-card";
import { UserClaimsStats } from "@/components/user-claims-stats";
import { cn } from "@/lib/utils";

type TabType = "ongoing" | "past";

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

  const {
    delulus,
    isLoading: isLoadingDelulus,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useGraphUserDelulus(activeTab);

  // Helper to check if content is loaded (not a hash)
  const isContentLoaded = (delulu: FormattedDelulu): boolean => {
    if (!delulu.content) return false;
    const isHash = delulu.content.startsWith("Qm") || 
      (delulu.content.length > 40 && /^[a-f0-9]+$/i.test(delulu.content));
    return !isHash;
  };

  // Filter out delulus without loaded content
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

  // Show login prompt if not connected
  useEffect(() => {
    if (!isConnected) {
      setShowLoginSheet(true);
    }
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="relative h-screen flex flex-col overflow-y-auto scrollbar-hide"
        >
          <div className="px-6 pt-4 pb-3 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-full w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-delulu-charcoal transition-colors"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="h-7 w-7" />
            </button>
            <div className="flex items-center justify-center flex-1">
              <h2 className="text-sm text-gray-500">
                {isLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : user?.username ? (
                  `@${user.username}`
                ) : address ? (
                  formatAddress(address)
                ) : (
                  "User"
                )}
              </h2>
            </div>
            <button
              onClick={() => setLogoutSheetOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
              title="Disconnect"
              aria-label="Disconnect"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full border-t border-gray-200" />

          {/* User Claims Stats */}
          <UserClaimsStats address={address} />

          {/* GoodDollar Claim entry point (mobile) */}
          <div className="px-6 pt-3 pb-1">
            <button
              onClick={() => router.push("/ubi")}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black text-delulu-yellow-reserved flex items-center justify-center shadow-[2px_2px_0px_0px_#000000]">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-delulu-charcoal">
                    Claim G$ UBI
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Open the GoodDollar claim interface.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-1 border-b border-gray-200 bg-white sticky top-0 z-10">
            <button
              onClick={() => setActiveTab("ongoing")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors relative",
                activeTab === "ongoing"
                  ? "text-delulu-charcoal"
                  : "text-gray-400 hover:text-delulu-charcoal"
              )}
            >
              Ongoing
              {activeTab === "ongoing" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-charcoal rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors relative",
                activeTab === "past"
                  ? "text-delulu-charcoal"
                  : "text-gray-400 hover:text-delulu-charcoal"
              )}
            >
              Past
              {activeTab === "past" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-charcoal rounded-full" />
              )}
            </button>
          </div>

          {address && (
            <div className="px-6 mb-6 pb-8 pt-3">
              {isLoadingDelulus ? (
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-full aspect-[4/5] bg-gray-100 rounded-xl border border-gray-200 animate-pulse"
                    />
                  ))}
                </div>
              ) : delulusWithContent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  {activeTab === "ongoing"
                    ? "You haven't created any ongoing delulus yet"
                    : "You haven't created any past delulus yet"}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[1, 2].map((i) => (
                        <div
                          key={`loading-${i}`}
                          className="w-full aspect-[4/5] bg-gray-100 rounded-xl border border-gray-200 animate-pulse"
                        />
                      ))}
                    </div>
                  )}

                  {!hasNextPage && delulusWithContent.length > 0 && (
                    <div className="text-center py-4 mt-2">
                      <p className="text-sm text-gray-400">
                        You&apos;ve reached the end
                      </p>
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
          // If login sheet is closed and still not connected, go back
          if (!open && !isConnected) {
            router.back();
          }
        }}
      />
    </div>
  );
}
