"use client"

import { useState } from "react"
import { TrendingUp, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/navbar"
import { LoginScreen } from "@/components/login-screen"
import { CreateDelusionSheet } from "@/components/create-delusion-sheet"
import { ProfileSheet } from "@/components/profile-sheet"
import { DeluluCardSkeleton } from "@/components/delulu-skeleton"
import { DeluluDetailsSheet } from "@/components/delulu-details-sheet"
import { useAccount } from "wagmi"
import { useDelulus, type FormattedDelulu } from "@/hooks/use-delulus"

function formatTimeRemaining(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  if (diff <= 0) return "Ended"
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${Math.floor(diff / (1000 * 60))}m`
}

function isEndingSoon(deadline: Date): boolean {
  const diff = deadline.getTime() - Date.now()
  const hours = diff / (1000 * 60 * 60)
  return hours > 0 && hours <= 24
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const staticHotDelusions = [
  {
    id: 1,
    claim: "I'll 100x my portfolio with this one altcoin I found",
    creator: "degen_ape",
    believers: 234,
    doubters: 567,
    pool: 12400,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: 2,
    claim: "My situationship will finally commit after I stake $5k",
    creator: "hopeless",
    believers: 89,
    doubters: 890,
    pool: 5600,
    deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
  },
  {
    id: 3,
    claim: "I'll get my ex back by showing them my crypto gains",
    creator: "toxic_trader",
    believers: 156,
    doubters: 678,
    pool: 8900,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
]

export default function HomePage() {
  const { isConnected } = useAccount()
  const { delulus, isLoading } = useDelulus()
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [profileSheetOpen, setProfileSheetOpen] = useState(false)
  const [selectedDelulu, setSelectedDelulu] = useState<FormattedDelulu | null>(null)
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)
  
  console.log("=== HomePage Debug ===");
  console.log("Delulus from hook:", delulus);
  console.log("Is Loading:", isLoading);
  console.log("Delulus Count:", delulus.length);
  console.log("======================");
  
  const hotDelusions = staticHotDelusions
  const trendingDelusions = delulus.slice(0)
  const endingSoonDelusions = delulus
    .filter((d) => !d.isResolved && isEndingSoon(d.stakingDeadline))
    .sort((a, b) => a.stakingDeadline.getTime() - b.stakingDeadline.getTime())
    .slice(0, 5)

  // Show login screen if not connected
  if (!isConnected) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-screen bg-delulu-yellow">
      <Navbar onProfileClick={() => setProfileSheetOpen(true)} />
      
      <main className="max-w-lg mx-auto pt-4 pb-24">
        {/* Hot Delusions - Swipeable */}
        <div className="mb-5">
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {hotDelusions.map((delusion) => (
              <button
                key={delusion.id}
                onClick={() => {
                  // For static hot delusions, create a mock FormattedDelulu
                  const mockDelulu: FormattedDelulu = {
                    id: delusion.id,
                    creator: delusion.creator,
                    contentHash: delusion.claim,
                    content: delusion.claim,
                    stakingDeadline: delusion.deadline,
                    resolutionDeadline: new Date(delusion.deadline.getTime() + 24 * 60 * 60 * 1000),
                    totalBelieverStake: delusion.believers,
                    totalDoubterStake: delusion.doubters,
                    totalStake: delusion.pool,
                    outcome: false,
                    isResolved: false,
                    isCancelled: false,
                  };
                  setSelectedDelulu(mockDelulu);
                  setDetailsSheetOpen(true);
                }}
                className="shrink-0 w-full snap-center"
              >
                <div 
                  className="relative rounded-3xl p-5 h-[200px] active:scale-[0.98] transition-transform overflow-hidden flex flex-col"
                  style={{
                    background: "linear-gradient(135deg, #f9e79f 0%, #f7dc6f 10%, #d4af37 25%, #c9a227 40%, #d4af37 55%, #f4e4a6 70%, #d4af37 85%, #f9e79f 100%)",
                    boxShadow: `
                      inset 0 2px 4px rgba(255, 255, 255, 0.5),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.3),
                      0 4px 8px rgba(0, 0, 0, 0.2),
                      0 8px 16px rgba(212, 175, 55, 0.3),
                      0 0 0 1px rgba(212, 175, 55, 0.4),
                      0 0 20px rgba(212, 175, 55, 0.2)
                    `,
                    border: "2px solid",
                    borderColor: "rgba(212, 175, 55, 0.6)",
                  }}
                >
                  {/* Base metallic texture */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: `
                        repeating-linear-gradient(
                          45deg,
                          transparent,
                          transparent 2px,
                          rgba(255, 255, 255, 0.05) 2px,
                          rgba(255, 255, 255, 0.05) 4px
                        ),
                        repeating-linear-gradient(
                          -45deg,
                          transparent,
                          transparent 2px,
                          rgba(0, 0, 0, 0.05) 2px,
                          rgba(0, 0, 0, 0.05) 4px
                        )
                      `,
                    }}
                  />
                  
                  {/* Animated metallic shine */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)",
                      transform: "translateX(-100%)",
                      animation: "shimmer 4s ease-in-out infinite",
                    }}
                  />
                  
                  {/* Top highlight */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-1/3 opacity-60"
                    style={{
                      background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.3), transparent)",
                      borderRadius: "1.5rem 1.5rem 0 0",
                    }}
                  />
                  
                  {/* Bottom shadow */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-1/3 opacity-40"
                    style={{
                      background: "linear-gradient(to top, rgba(0, 0, 0, 0.2), transparent)",
                      borderRadius: "0 0 1.5rem 1.5rem",
                    }}
                  />
                  
                  {/* Corner highlights */}
                  <div 
                    className="absolute top-0 left-0 w-20 h-20 opacity-30"
                    style={{
                      background: "radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)",
                    }}
                  />
                  <div 
                    className="absolute top-0 right-0 w-20 h-20 opacity-30"
                    style={{
                      background: "radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)",
                    }}
                  />
                  
                  <div className="relative flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-xs font-bold text-white drop-shadow">
                          {formatAddress(delusion.creator).slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "#2d2d2d", textShadow: "0 1px 1px rgba(255, 255, 255, 0.5)" }}>
                        {delusion.creator}
                      </span>
                      <span className="ml-auto text-xs font-bold text-white px-2 py-1 rounded-full" style={{
                        background: "rgba(0, 0, 0, 0.7)",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                      }}>HOT</span>
                    </div>
                    
                    <p className="text-xl font-black leading-tight flex-1 line-clamp-2" style={{
                      color: "#1a1a1a",
                      textShadow: "0 1px 2px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.5)"
                    }}>
                      &ldquo;{delusion.claim}&rdquo;
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <RingProgress 
                        believe={delusion.believers} 
                        doubt={delusion.doubters} 
                        dark 
                      />
                      <span className="text-2xl font-black" style={{
                        color: "#1a1a1a",
                        textShadow: "0 1px 2px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.4)"
                      }}>
                        ${delusion.pool}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="flex justify-center gap-1.5 mt-3">
            {hotDelusions.map((_, i) => (
              <div key={i} className={cn(
                "w-1.5 h-1.5 rounded-full",
                i === 0 ? "bg-delulu-dark" : "bg-delulu-dark/20"
              )} />
            ))}
          </div>
        </div>
        
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
              <p className="text-base font-black text-delulu-dark">Create Delusion</p>
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
                <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">Ending Soon</span>
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
                        {formatAddress(delusion.creator).slice(0, 2).toUpperCase()}
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
                        ${delusion.totalStake > 0 
                          ? (delusion.totalStake < 1 
                              ? delusion.totalStake.toFixed(2) 
                              : delusion.totalStake.toFixed(0))
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
              <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">Trending</span>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <DeluluCardSkeleton key={i} />
                ))
              ) : (
                trendingDelusions.map((delusion) => (
                  <DelusionCard 
                    key={delusion.id} 
                    delusion={delusion}
                    onClick={() => {
                      setSelectedDelulu(delusion);
                      setDetailsSheetOpen(true);
                    }}
                  />
                ))
              )}
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
  )
}

function RingProgress({ 
  believe, 
  doubt,
  dark = false,
}: { 
  believe: number
  doubt: number
  dark?: boolean
}) {
  const total = believe + doubt
  const percent = total > 0 ? Math.round((believe / total) * 100) : 0
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (percent / 100) * circumference
  
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-11 h-11">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke={dark ? "rgba(0,0,0,0.2)" : "rgba(252,255,82,0.2)"} strokeWidth="4" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={dark ? "#000000" : "#fcff52"} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-black", dark ? "text-black" : "text-white")}>
          {percent}%
        </span>
      </div>
      <div className="flex flex-col">
        <span className={cn("text-xs font-bold", dark ? "text-black" : "text-white")}>
          {believe > 0 ? (believe < 0.01 ? believe.toFixed(4) : believe.toFixed(2)) : "0.00"} cUSD
        </span>
        <span className={cn("text-xs", dark ? "text-black/50" : "text-white/50")}>
          {doubt > 0 ? (doubt < 0.01 ? doubt.toFixed(4) : doubt.toFixed(2)) : "0.00"} cUSD
        </span>
      </div>
    </div>
  )
}

function DelusionCard({ 
  delusion, 
  onClick 
}: { 
  delusion: FormattedDelulu;
  onClick: () => void;
}) {
  const total = delusion.totalBelieverStake + delusion.totalDoubterStake
  const believerPercent = total > 0 ? Math.round((delusion.totalBelieverStake / total) * 100) : 0
  
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
            <span className="text-delulu-purple">
              {delusion.totalStake > 0 
                ? (delusion.totalStake < 0.01 
                    ? delusion.totalStake.toFixed(4) 
                    : delusion.totalStake.toFixed(2))
                : "0.00"} 
            </span> cUSD staked
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(10,10,10,0.2)" strokeWidth="3" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 12} strokeDashoffset={2 * Math.PI * 12 - (believerPercent / 100) * 2 * Math.PI * 12} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-delulu-dark">
              {believerPercent}%
            </span>
          </div>
          <span className="text-sm font-black text-delulu-dark">
            ${delusion.totalStake > 0 
              ? (delusion.totalStake < 1 
                  ? delusion.totalStake.toFixed(2) 
                  : delusion.totalStake.toFixed(0))
              : "0"}
          </span>
        </div>
      </div>
    </button>
  )
}
