"use client"

import { TrendingUp, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/navbar"
import Link from "next/link"

const hotDelusions = [
  {
    id: 1,
    claim: "I'll 100x my portfolio with this one altcoin I found",
    creator: "degen_ape",
    believers: 234,
    doubters: 567,
    pool: 12400,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  },
  {
    id: 2,
    claim: "My situationship will finally commit after I stake $5k",
    creator: "hopeless",
    believers: 89,
    doubters: 890,
    pool: 5600,
    deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
  },
  {
    id: 5,
    claim: "I'll get my ex back by showing them my crypto gains",
    creator: "toxic_trader",
    believers: 156,
    doubters: 678,
    pool: 8900,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
]

const delusions = [
  {
    id: 3,
    claim: "I'll make $1M from a single NFT flip this month",
    creator: "nft_whale",
    believers: 345,
    doubters: 123,
    pool: 15600,
    deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
  },
  {
    id: 4,
    claim: "My crush will slide into my DMs after I flex my ETH stack",
    creator: "crypto_rizz",
    believers: 67,
    doubters: 456,
    pool: 3200,
    deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
  },
  {
    id: 6,
    claim: "I'll find my soulmate in a DeFi discord server",
    creator: "lonely_dev",
    believers: 234,
    doubters: 789,
    pool: 7800,
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
  },
  {
    id: 7,
    claim: "My ex will regret leaving when I hit $100k in crypto",
    creator: "revenge_trader",
    believers: 189,
    doubters: 567,
    pool: 10200,
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
  },
  {
    id: 8,
    claim: "I'll get a date by proving I'm not a bot on-chain",
    creator: "verified_human",
    believers: 45,
    doubters: 890,
    pool: 2100,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  {
    id: 9,
    claim: "I'll marry someone I met through a DAO proposal",
    creator: "dao_romantic",
    believers: 123,
    doubters: 456,
    pool: 4500,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  },
  {
    id: 10,
    claim: "I'll 10x my portfolio by end of today",
    creator: "yolo_trader",
    believers: 89,
    doubters: 234,
    pool: 5600,
    deadline: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours from now
  },
  {
    id: 11,
    claim: "My ex will text me back before midnight",
    creator: "hopeful_one",
    believers: 123,
    doubters: 456,
    pool: 3200,
    deadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
  },
  {
    id: 12,
    claim: "I'll land that job offer by tomorrow morning",
    creator: "job_hunter",
    believers: 67,
    doubters: 189,
    pool: 2100,
    deadline: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
  },
]

const recentWinners = [
  { creator: "crypto_queen", claim: "Made $50k from a meme coin and got my ex back", won: 12400 },
  { creator: "dao_lover", claim: "Found my partner through a governance vote", won: 8900 },
]

// Helper function to format time remaining
function formatTimeRemaining(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  
  if (diff <= 0) return "Ended"
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    const minutes = Math.floor(diff / (1000 * 60))
    return `${minutes}m`
  }
}

// Helper function to check if delusion is ending soon (within 24 hours)
function isEndingSoon(deadline: Date): boolean {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const hours = diff / (1000 * 60 * 60)
  return hours > 0 && hours <= 24
}

export default function HomePage() {
  // Get all delusions and filter for ending soon
  const allDelusions = [...hotDelusions, ...delusions]
  const endingSoonDelusions = allDelusions
    .filter(d => d.deadline && isEndingSoon(d.deadline))
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
    .slice(0, 5) // Limit to 5 most urgent
  return (
    <div className="min-h-screen bg-delulu-yellow">
      <Navbar />
      
      <main className="max-w-lg mx-auto pt-4 pb-24">
        {/* Hot Delusions - Swipeable */}
        <div className="mb-5">
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {hotDelusions.map((delusion) => (
              <Link 
                key={delusion.id}
                href={`/delusion/${delusion.id}`}
                className="shrink-0 w-full snap-center"
              >
                <div 
                  className="relative rounded-3xl p-5 h-[200px] active:scale-[0.98] transition-transform overflow-hidden flex flex-col"
                  style={{
                    background: "linear-gradient(145deg, #d4af37 0%, #f4e4a6 15%, #d4af37 30%, #aa8c2c 50%, #d4af37 70%, #f4e4a6 85%, #d4af37 100%)",
                  }}
                >
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.5) 50%, transparent 75%)",
                    }}
                  />
                  
                  <div className="relative flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-xs font-bold text-white drop-shadow">
                          {delusion.creator.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-black/60">{delusion.creator}</span>
                      <span className="ml-auto text-xs font-bold text-white bg-black/80 px-2 py-1 rounded-full">HOT</span>
                    </div>
                    
                    <p className="text-xl font-black text-black leading-tight drop-shadow-sm flex-1 line-clamp-2">
                      &ldquo;{delusion.claim}&rdquo;
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <RingProgress believe={delusion.believers} doubt={delusion.doubters} dark />
                      <span className="text-2xl font-black text-black">${delusion.pool}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Dots indicator */}
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
          <Link
            href="/create"
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
          </Link>
        
          {/* Ending Soon */}
          {endingSoonDelusions.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-delulu-dark/50" />
                <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">Ending Soon</span>
              </div>
              <div className="space-y-2">
                {endingSoonDelusions.map((delusion) => (
                  <Link 
                    key={delusion.id}
                    href={`/delusion/${delusion.id}`}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-delulu-dark/5 active:scale-[0.98] transition-transform hover:bg-delulu-dark/10"
                  >
                    <div className="w-8 h-8 rounded-full bg-delulu-dark/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-delulu-dark">
                        {delusion.creator.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-delulu-dark truncate">{delusion.claim}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-delulu-dark">
                        {formatTimeRemaining(delusion.deadline!)}
                      </p>
                      <p className="text-xs text-delulu-dark/50">${delusion.pool}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        
          {/* Trending */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-delulu-dark/50" />
              <span className="text-xs font-bold text-delulu-dark/50 uppercase tracking-wider">Trending</span>
            </div>
            <div className="space-y-2">
              {delusions.map((delusion) => (
                <DelusionCard key={delusion.id} {...delusion} />
              ))}
            </div>
          </div>
        </div>
      </main>
      
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
  const percent = Math.round((believe / total) * 100)
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (percent / 100) * circumference
  
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-11 h-11">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={dark ? "rgba(0,0,0,0.2)" : "rgba(252,255,82,0.2)"}
            strokeWidth="4"
          />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke={dark ? "#000000" : "#fcff52"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <span className={cn(
          "absolute inset-0 flex items-center justify-center text-xs font-black",
          dark ? "text-black" : "text-white"
        )}>
          {percent}%
        </span>
      </div>
      <div className="flex flex-col">
        <span className={cn("text-xs font-bold", dark ? "text-black" : "text-white")}>{believe} believe</span>
        <span className={cn("text-xs", dark ? "text-black/50" : "text-white/50")}>{doubt} doubt</span>
      </div>
    </div>
  )
}

function DelusionCard({ 
  id,
  claim, 
  creator, 
  believers, 
  doubters, 
  pool,
}: {
  id: number
  claim: string
  creator: string
  believers: number
  doubters: number
  pool: number
}) {
  const total = believers + doubters
  const believerPercent = Math.round((believers / total) * 100)
  
  return (
    <Link 
      href={`/delusion/${id}`}
      className={cn(
        "block p-4 rounded-2xl",
        "bg-delulu-dark/5",
        "active:scale-[0.98] transition-transform"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-delulu-dark/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-delulu-dark">
            {creator.slice(0, 2).toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-delulu-dark truncate">{claim}</p>
          <span className="text-xs text-delulu-dark "><span className="text-delulu-purple">{believers + doubters}</span> stakers</span>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(10,10,10,0.2)" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="#0a0a0a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 12}
                strokeDashoffset={2 * Math.PI * 12 - (believerPercent / 100) * 2 * Math.PI * 12}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-delulu-dark">
              {believerPercent}
            </span>
          </div>
          <span className="text-sm font-black text-delulu-dark">${pool}</span>
        </div>
      </div>
    </Link>
  )
}
