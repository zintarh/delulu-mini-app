"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DelusionCard } from "@/components/delusion-card"
import { UserHeader } from "@/components/user-header"
import {
  Sparkles,
  Shield,
  Plus,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"
import { farcasterUser, mockDelusions } from "@/lib/mock-data"

export default function HomePage() {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)

  return (
    <div className="min-h-screen bg-background pb-8">
      <UserHeader 
        username={farcasterUser.username} 
        pfp={farcasterUser.pfp}
        address={farcasterUser.address}
      />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-4 mt-6">
        <Card
          className="bg-card border border-border p-4 cursor-pointer hover:border-delulu-yellow/50 transition-all"
          onClick={() => router.push("/verify")}
        >

          <p>Take out later</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isVerified ? 'bg-delulu-green' : 'bg-muted'}`}>
                {isVerified ? <Sparkles className="w-5 h-5 text-white" /> : <Shield className="w-4 h-4 text-muted-foreground" />}
              </div>
              <p className="font-black text-base">{isVerified ? "Verified" : "Verify Identity"}</p>
            </div>
            <Badge
              className={isVerified ? "bg-delulu-green/10 text-delulu-green border-delulu-green/20" : ""}
            >
              {isVerified ? <CheckCircle2 className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            </Badge>
          </div>
        </Card>

        <Button
          size="lg"
          className="w-full h-16 bg-delulu-yellow hover:bg-delulu-yellow/90 text-delulu-dark font-black text-lg rounded-2xl shadow-lg hover:scale-[1.02] transition-all"
          onClick={() => router.push("/create")}
        >
          <Plus className="w-6 h-6 mr-2" />
          CREATE DELUSION
        </Button>

        <div className="space-y-2.5 mt-8">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-delulu-yellow" />
            <h2 className="font-black text-lg">Active Delusions</h2>
          </div>

          {mockDelusions.map((delusion) => (
            <DelusionCard
              key={delusion.id}
              {...delusion}
              onClick={() => router.push(`/delusion/${delusion.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
