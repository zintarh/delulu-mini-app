"use client"

import { useState, useEffect } from "react"
import { useAccount, useBalance } from "wagmi"
import { Coins } from "lucide-react"
import { cn } from "@/lib/utils"

interface WalletBalanceProps {
  className?: string
}

export function WalletBalance({ className }: WalletBalanceProps) {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const { data: balance, isLoading } = useBalance({ address })

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isConnected) {
    return null
  }

  const formattedBalance = balance 
    ? parseFloat(balance.formatted).toFixed(2)
    : "0.00"

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2",
      "bg-delulu-yellow/10 rounded-xl",
      className
    )}>
      <Coins className="w-4 h-4 text-delulu-yellow" />
      <span className="text-sm font-bold text-delulu-white">
        {isLoading ? "..." : formattedBalance}
      </span>
      <span className="text-xs text-delulu-white/50">
        {balance?.symbol || "CELO"}
      </span>
    </div>
  )
}
