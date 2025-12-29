"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { LoginScreen } from "@/components/login-screen";
import { CreateDelusionSheet } from "@/components/create-delusion-sheet";
import { ProfileSheet } from "@/components/profile-sheet";
import { DeluluCardSkeleton } from "@/components/delulu-skeleton";
import { DeluluDetailsSheet } from "@/components/delulu-details-sheet";
import { HowItWorksSheet } from "@/components/how-it-works-sheet";
import { AllDelulusSheet } from "@/components/all-delulus-sheet";
import { DeluluCard } from "@/components/delulu-card";
import { BelieveSheet } from "@/components/believe-sheet";
import { DoubtSheet } from "@/components/doubt-sheet";
import { LogoutSheet } from "@/components/logout-sheet";
import { ClaimRewardsSheet } from "@/components/claim-rewards-sheet";
import { useAccount, useDisconnect } from "wagmi";
import { useUserStore } from "@/stores/useUserStore";
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus";
import { useUserStats } from "@/hooks/use-user-stats";
import { TrendingUp, Plus } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"vision" | "fyp">("fyp");
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    const mainElement = document.querySelector('main');
    const windowElement = window;
    
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll);
    }
    windowElement.addEventListener('scroll', handleScroll);
    
    return () => {
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
      windowElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const filteredDelulus =
    activeTab === "vision"
      ? delulus.filter((delulu) => {
          return true;
        })
      : delulus;

  const trendingDelusions = filteredDelulus.slice(0, 5);

  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[275px_1fr_350px] min-h-screen">
        <div className="hidden lg:block">
          <LeftSidebar
            onProfileClick={() => setProfileSheetOpen(true)}
            onLogoutClick={() => setLogoutSheetOpen(true)}
            onCreateClick={() => setCreateSheetOpen(true)}
          />
        </div>

        <main className="min-h-screen lg:border-x border-gray-800 overflow-y-auto">
          <div className="lg:hidden">
            <Navbar
              onProfileClick={() => setProfileSheetOpen(true)}
              onLogoutClick={() => setLogoutSheetOpen(true)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          <div className="hidden lg:block sticky top-0 z-30 bg-black/95 backdrop-blur-sm border-b border-gray-800">
            <div className="flex items-center h-14">
              <button
                onClick={() => setActiveTab("vision")}
                className={cn(
                  "flex-1 h-full flex items-center justify-center text-base font-bold transition-colors relative",
                  activeTab === "vision"
                    ? "text-white"
                    : "text-white/60 hover:text-white"
                )}
              >
                Vision
                {activeTab === "vision" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-yellow-reserved" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("fyp")}
                className={cn(
                  "flex-1 h-full flex items-center justify-center text-base font-medium transition-colors relative",
                  activeTab === "fyp"
                    ? "text-white"
                    : "text-white/60 hover:text-white"
                )}
              >
                For you
                {activeTab === "fyp" && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-yellow-reserved" />
                )}
              </button>
            </div>
          </div>

          <div className="px-4 lg:px-6 py-6 space-y-6 pb-32 lg:pb-6 pt-20 lg:pt-6">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <DeluluCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredDelulus.length > 0 ? (
              <div className="flex flex-col gap-3">
                {filteredDelulus.map((delusion) => (
                  <DeluluCard
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
                <p className="text-white/60 text-sm">No delulus yet</p>
                <p className="text-white/50 text-xs mt-1">
                  Start by creating your first delulu
                </p>
              </div>
            )}
          </div>
        </main>

        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>

      <button
        onClick={() => setCreateSheetOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-6 right-6 rounded-lg bg-delulu-yellow-reserved text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-all duration-300 z-40",
          isScrolling ? "w-14 h-14 px-3" : "h-14 px-3"
        )}
        style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)' }}
      >
        <Plus className={cn("transition-all duration-300", isScrolling ? "w-8 h-8" : "w-6 h-6 mr-1")} />
        {!isScrolling && (
          <span className="text-base font-bold whitespace-nowrap">Board</span>
        )}
      </button>

      <CreateDelusionSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
      />

      <ProfileSheet
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
      />

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

      <HowItWorksSheet
        open={howItWorksSheetOpen}
        onOpenChange={setHowItWorksSheetOpen}
        type={howItWorksType}
      />

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

      <BelieveSheet
        open={believeSheetOpen}
        onOpenChange={setBelieveSheetOpen}
        delulu={selectedDelulu}
      />

      <DoubtSheet
        open={doubtSheetOpen}
        onOpenChange={setDoubtSheetOpen}
        delulu={selectedDelulu}
      />

      <LogoutSheet
        open={logoutSheetOpen}
        onOpenChange={setLogoutSheetOpen}
        onLogout={() => {
          disconnect();
          useUserStore.getState().logout();
          setLogoutSheetOpen(false);
        }}
      />

      <ClaimRewardsSheet
        open={claimRewardsSheetOpen}
        onOpenChange={setClaimRewardsSheetOpen}
      />
    </div>
  );
}
