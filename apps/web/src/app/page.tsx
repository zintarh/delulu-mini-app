"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LoginScreen } from "@/components/login-screen";
import { CreateDelusionSheet } from "@/components/create-delusion-sheet";
import { ProfileSheet } from "@/components/profile-sheet";
import {  TwitterPostCardSkeleton } from "@/components/delulu-skeleton";
import { DeluluDetailsSheet } from "@/components/delulu-details-sheet";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { AllDelulusSheet } from "@/components/all-delulus-sheet";
import { TwitterPostCard } from "@/components/twitter-post-card";
import { BelieveSheet } from "@/components/believe-sheet";
import { DoubtSheet } from "@/components/doubt-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAccount, useDisconnect } from "wagmi";
import { useUserStore } from "@/stores/useUserStore";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";
import { useUserStats } from "@/hooks/use-user-stats";
import {  TrendingUp } from "lucide-react";


export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { delulus, isLoading } = useDelulus();
  const {
    createdCount,
    totalStakes,
    totalEarnings,
    isLoading: isLoadingStats,
  } = useUserStats();


  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(
    null
  );
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [howItWorksSheetOpen, setHowItWorksSheetOpen] = useState(false);
  const [howItWorksType, setHowItWorksType] = useState<
    "concept" | "market" | "conviction"
  >("concept");
  const [allDelulusSheetOpen, setAllDelulusSheetOpen] = useState(false);
  const [believeSheetOpen, setBelieveSheetOpen] = useState(false);
  const [doubtSheetOpen, setDoubtSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [claimRewardsSheetOpen, setClaimRewardsSheetOpen] = useState(false);
  const trendingDelusions = [...delulus].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-home-gradient">
      <Navbar 
        onProfileClick={() => setProfileSheetOpen(true)} 
        onLogoutClick={() => setLogoutSheetOpen(true)}
      />

      <main className="max-w-lg mx-auto pt-4 pb-32">
        <div className="px-4 space-y-6">
       
          <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/10">
            <div>
              <p className="text-xs text-white/60 mb-2">Rewards</p>
              <p className="text-2xl font-black text-white/90">
                {isLoadingStats ? "..." : `$${totalEarnings.toFixed(2)}`}
              </p>
              <p className="text-xs text-white/40 mt-1">earned</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-delulu-yellow/50" />
                <span className="text-xs font-bold text-delulu-yellow/50 uppercase tracking-wider">
                  Trending
                </span>
              </div>
              {delulus.length > 0 && (
                <button
                  onClick={() => setAllDelulusSheetOpen(true)}
                  className="text-xs text-delulu-yellow font-bold hover:text-delulu-yellow/80 transition-colors underline"
                >
                  See All
                </button>
              )}
            </div>
            {isLoading ? (
              <div
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <TwitterPostCardSkeleton key={i} />
                ))}
              </div>
            ) : trendingDelusions.length > 0 ? (
              <div
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {trendingDelusions.map((delusion) => (
                  <TwitterPostCard
                    key={delusion.id}
                    delusion={delusion}
                    onClick={() => {
                      setSelectedDelulu(delusion);
                      setDetailsSheetOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/50 text-sm">No delulus yet</p>
                <p className="text-white/30 text-xs mt-1">
                  Start by creating your first delulu
                </p>
              </div>
            )}
          </div>

          {/* Explore Delulu Section */}
          <div>
            <h2 className="text-xl font-black text-white/90 mb-4">
              Explore Delulu
            </h2>
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Card 1: What is Delulu */}
              <button
                onClick={() => {
                  setHowItWorksType("concept");
                  setHowItWorksSheetOpen(true);
                }}
                className="shrink-0 w-[85%] sm:w-[400px] bg-white/5 rounded-2xl p-5 border border-white/10 active:scale-[0.98] transition-transform text-left h-[280px] flex flex-col"
              >
                <div className="flex-1">
                  <p className="text-xs text-white/60 mb-1">Concept</p>
                  <p className="text-lg font-black text-white/90 mb-1">
                    What is Delulu?
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Turn your wild goals and opinions into high-stakes prediction markets. Monetize your delusions.
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  {/* <img
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&h=200&fit=crop&q=80"
                    alt="What is Delulu"
                    className="w-32 h-32 rounded-2xl object-cover"
                  /> */}
                </div>
              </button>

              {/* Card 2: The Market */}
              <button
                onClick={() => {
                  setHowItWorksType("market");
                  setHowItWorksSheetOpen(true);
                }}
                className="shrink-0 w-[85%] sm:w-[400px] bg-white/5 rounded-2xl p-5 border border-white/10 active:scale-[0.98] transition-transform text-left h-[280px] flex flex-col"
              >
                <div className="flex-1">
                  <p className="text-xs text-white/60 mb-1">The Market</p>
                  <p className="text-lg font-black text-white/90 mb-1">
                    Prediction Markets
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Stake to believe or doubt. The ratio reflects collective conviction. Winners take the pot.
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  {/* <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80"
                    alt="The Market"
                    className="w-32 h-32 rounded-2xl object-cover"
                  /> */}
                </div>
              </button>

              {/* Card 3: Your Conviction */}
              <button
                onClick={() => {
                  setHowItWorksType("conviction");
                  setHowItWorksSheetOpen(true);
                }}
                className="shrink-0 w-[85%] sm:w-[400px] bg-white/5 rounded-2xl p-5 border border-white/10 active:scale-[0.98] transition-transform text-left h-[280px] flex flex-col"
              >
                <div className="flex-1">
                  <p className="text-xs text-white/60 mb-1">Rewards</p>
                  <p className="text-lg font-black text-white/90 mb-1">
                    Your Conviction
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Back your beliefs with real stakes. Win financial rewards and social validation when you&apos;re right.
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  {/* <img
                    src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=200&h=200&fit=crop&q=80"
                    alt="Your Conviction"
                    className="w-32 h-32 rounded-2xl object-cover"
                  /> */}
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Create Delulu Button - Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-delulu-dark border-t border-white/10 z-40">
        <button
          onClick={() => setCreateSheetOpen(true)}
          className={cn(
            "w-full",
            "px-8 py-4",
            "bg-delulu-yellow text-delulu-dark text-lg",
            "btn-game"
          )}
        >
          Create Delulu
        </button>
      </div>

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
        onBelieve={() => {
          setDetailsSheetOpen(false);
          setBelieveSheetOpen(true);
        }}
        onDoubt={() => {
          setDetailsSheetOpen(false);
          setDoubtSheetOpen(true);
        }}
      />

      {/* How It Works Bottom Sheet */}
      <HowItWorksSheet
        open={howItWorksSheetOpen}
        onOpenChange={setHowItWorksSheetOpen}
        type={howItWorksType}
      />

      {/* All Delulus Bottom Sheet */}
      <AllDelulusSheet
        open={allDelulusSheetOpen}
        onOpenChange={setAllDelulusSheetOpen}
        delulus={delulus}
        isLoading={isLoading}
        onDeluluClick={(delulu) => {
          setSelectedDelulu(delulu);
          setDetailsSheetOpen(true);
        }}
      />

      {/* Believe Sheet */}
      <BelieveSheet
        open={believeSheetOpen}
        onOpenChange={setBelieveSheetOpen}
        delulu={selectedDelulu}
      />

      {/* Doubt Sheet */}
      <DoubtSheet
        open={doubtSheetOpen}
        onOpenChange={setDoubtSheetOpen}
        delulu={selectedDelulu}
      />

      {/* Logout Sheet */}
      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={() => {
          disconnect();
          useUserStore.getState().logout();
          setLogoutSheetOpen(false);
        }}
      />

      {/* Claim Rewards Sheet */}
      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />
    </div>
  );
}

