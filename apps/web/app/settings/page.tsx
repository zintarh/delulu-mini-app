"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Wallet, DollarSign, Shield, User } from "lucide-react"
import { farcasterUser } from "@/lib/mock-data"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Settings" />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-6 mt-6">
        <Card className="p-6 bg-card border border-delulu-yellow/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-delulu-yellow/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-delulu-yellow" />
            </div>
            <div>
              <h2 className="font-black text-xl">Wallet</h2>
              <p className="text-xs text-muted-foreground font-medium">MiniPay</p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Address</span>
              <span className="text-sm font-mono font-bold">0x742d...35Aa</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Balance</span>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-delulu-yellow" />
                <span className="font-black text-2xl text-delulu-yellow">1,234.50</span>
                <span className="text-sm text-muted-foreground font-medium">cUSD</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border border-delulu-green/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-delulu-green/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-delulu-green" />
            </div>
            <div>
              <h2 className="font-black text-xl">Vault</h2>
              <p className="text-xs text-muted-foreground font-medium">Platform earnings</p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Available</span>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-delulu-green" />
                <span className="font-black text-3xl text-delulu-green">456.78</span>
                <span className="text-sm text-muted-foreground font-medium">cUSD</span>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-14 bg-delulu-green hover:bg-delulu-green/90 text-white font-black text-base rounded-xl"
          >
            <DollarSign className="w-5 h-5 mr-2" />
            Claim
          </Button>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Protected by Celo</span>
          </div>
        </Card>

        <Card className="p-6 bg-card border border-border">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={farcasterUser.pfp || "/placeholder.svg"}
              alt={farcasterUser.username}
              className="w-16 h-16 rounded-full border-2 border-delulu-yellow"
            />
            <div>
              <p className="font-black text-xl">@{farcasterUser.username}</p>
              <p className="text-sm text-muted-foreground font-medium">FID: {farcasterUser.fid}</p>
            </div>
          </div>
          <Button variant="outline" size="lg" className="w-full h-12 font-bold rounded-xl border border-border bg-transparent">
            <User className="w-5 h-5 mr-2" />
            View Profile
          </Button>
        </Card>
      </div>
    </div>
  )
}

