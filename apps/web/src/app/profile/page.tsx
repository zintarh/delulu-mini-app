"use client"

import { useAccount } from "wagmi"
import { Trophy } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { ConnectedAccount } from "@/components/wallet"

const recentWinners = [
  { creator: "crypto_queen", claim: "Made $50k from a meme coin and got my ex back", won: 12400 },
  { creator: "dao_lover", claim: "Found my partner through a governance vote", won: 8900 },
]

export default function ProfilePage() {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-delulu-dark">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 pt-8 text-center">
          <p className="text-white/50">Please connect your wallet to view your profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-delulu-dark">
      <Navbar />
      
      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* Profile Header */}
        <div className="mb-6">
          <ConnectedAccount />
        </div>

        {/* Wallet Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-delulu-yellow rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-delulu-dark">$120</p>
            <p className="text-[10px] text-delulu-dark/60">earnings</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-white">8</p>
            <p className="text-[10px] text-white/60">stakes</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-white">3</p>
            <p className="text-[10px] text-white/60">active</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-white">5</p>
            <p className="text-[10px] text-white/60">closed</p>
          </div>
        </div>
        
        {/* Recent Winners */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-white/50" />
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Recent Winners</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {recentWinners.map((winner, i) => (
              <div key={i} className="shrink-0 bg-[#1a1a1a] rounded-2xl p-3 w-40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">
                      {winner.creator.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white">{winner.creator}</span>
                </div>
                <p className="text-xs text-white/50 truncate mb-1">{winner.claim}</p>
                <p className="text-sm font-black text-delulu-yellow">+${winner.won}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

