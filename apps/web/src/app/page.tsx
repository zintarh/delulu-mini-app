"use client";

import { useState } from "react";
import { TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LoginScreen } from "@/components/login-screen";
import { CreateDelusionSheet } from "@/components/create-delusion-sheet";
import { ProfileSheet } from "@/components/profile-sheet";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { DeluluDetailsSheet } from "@/components/delulu-details-sheet";
import { useAccount } from "wagmi";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";

function formatTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / (1000 * 60))}m`;
}

function isEndingSoon(deadline: Date): boolean {
  const diff = deadline.getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  return hours > 0 && hours <= 24;
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage() {
  const { isConnected } = useAccount();
  const { delulus, isLoading } = useDelulus();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(
    null
  );
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const trendingDelusions = delulus.slice(0);
  
  const endingSoonDelusions = delulus
    .filter((d) => !d.isResolved && isEndingSoon(d.stakingDeadline))
    .sort((a, b) => a.stakingDeadline.getTime() - b.stakingDeadline.getTime())
    .slice(0, 5);

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-delulu-yellow">
      <Navbar onProfileClick={() => setProfileSheetOpen(true)} />
      
      <main className="max-w-lg mx-auto pt-4 pb-24">
        <div className="px-4">
          {/* Create Button - Game Style */}
          <button
            onClick={() => setCreateSheetOpen(true)}
            className={cn(
              "block w-full mb-5",
              "relative overflow-hidden",
              "bg-gradient-to-b from-delulu-yellow via-delulu-yellow to-[#d4af37]",
              "rounded-lg py-3 px-4",
              "border-2 border-delulu-dark",
              "shadow-[0_4px_0_0_#0a0a0a]",
              "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
              "transition-all duration-150",
              "hover:brightness-105"
            )}
          >
            <div className="relative z-10 text-center">
              <p className="text-base font-black text-delulu-dark">
                Create Delusion
              </p>
            </div>
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
          </button>

          {/* Ending Soon */}
          {isLoading ? (
            <div className="mb-5 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <DeluluCardSkeleton key={i} />
              ))}
            </div>
          ) : endingSoonDelusions.length > 0 ? (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-delulu-dark/50" />
                <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">
                  Ending Soon
                </span>
          </div>
          <div className="space-y-2">
                {endingSoonDelusions.map((delusion) => (
                  <button
                    key={delusion.id}
                    onClick={() => {
                      setSelectedDelulu(delusion);
                      setDetailsSheetOpen(true);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-delulu-dark/5 active:scale-[0.98] transition-transform hover:bg-delulu-dark/10 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-delulu-dark/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-delulu-dark">
                        {formatAddress(delusion.creator)
                          .slice(0, 2)
                          .toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-delulu-dark truncate">
                        {delusion.content || delusion.contentHash}
                      </p>
                </div>
                <div className="text-right shrink-0">
                      <p className="text-xs font-black text-delulu-dark">
                        {formatTimeRemaining(delusion.stakingDeadline)}
                      </p>
                      <p className="text-xs text-delulu-dark/50">
                        $
                        {delusion.totalStake > 0
                          ? delusion.totalStake < 1
                            ? delusion.totalStake.toFixed(2)
                            : delusion.totalStake.toFixed(0)
                          : "0"}
                      </p>
                </div>
                  </button>
            ))}
          </div>
        </div>
          ) : null}
        
          {/* Trending */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-delulu-dark/50" />
              <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">
                Trending
              </span>
            </div>
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <DeluluCardSkeleton key={i} />
                  ))
                : trendingDelusions.map((delusion) => (
                    <DelusionCard
                      key={delusion.id}
                      delusion={delusion}
                      onClick={() => {
                        setSelectedDelulu(delusion);
                        setDetailsSheetOpen(true);
                      }}
                    />
              ))}
            </div>
          </div>
        </div>
      </main>
      
      {/* Create Delusion Bottom Sheet */}
      <CreateDelusionSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
      />

      {/* Profile Bottom Sheet */}
      <ProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
      />

      {/* Delulu Details Bottom Sheet */}
      <DeluluDetailsSheet
        open={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
        delulu={selectedDelulu}
      />
    </div>
  );
}

function DelusionCard({
  delusion,
  onClick,
}: {
  delusion: FormattedDelulu;
  onClick: () => void;
}) {
  const total = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const believerPercent =
    total > 0 ? Math.round((delusion.totalBelieverStake / total) * 100) : 0;
  
  return (
    <button
      onClick={onClick}
      className="w-full block p-4 rounded-2xl bg-delulu-dark/5 active:scale-[0.98] transition-transform text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-delulu-dark/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-delulu-dark">
            {formatAddress(delusion.creator).slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-delulu-dark truncate">
            {delusion.content || delusion.contentHash}
          </p>
          <span className="text-xs text-delulu-dark">
            <span className="text-delulu-purple font-black">
              {delusion.totalStake > 0
                ? delusion.totalStake < 0.01
                  ? delusion.totalStake.toFixed(4)
                  : delusion.totalStake.toFixed(2)
                : "0.00"}
            </span>{" "}
            cUSD staked
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* <div className="relative w-16 h-16" >
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56" style={{ filter: "drop-shadow(0 2px 0 #0a0a0a)" }}>
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 - (believerPercent / 100) * 2 * Math.PI * 22} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs  font-black text-delulu-dark">
              {believerPercent}%
            </span>
          </div> */}
          <span className="text-sm font-bold text-delulu-dark">
            $
            {delusion.totalStake > 0
              ? delusion.totalStake < 1
                ? delusion.totalStake.toFixed(2)
                : delusion.totalStake.toFixed(0)
              : "0"}
          </span>
        </div>
      </div>
    </button>
  );
}
