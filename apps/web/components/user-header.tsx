"use client"

import { Menu } from "lucide-react"
import { ConnectWallet } from "@/components/connect-wallet"

interface UserHeaderProps {
  username: string
  pfp: string
  address: string
}

export function UserHeader({ username, pfp, address }: UserHeaderProps) {
  return (
    <header className="bg-delulu-yellow border-b border-delulu-dark/10 sticky top-0 z-50 shadow-sm">
      <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-delulu-dark/5 active:bg-delulu-dark/10 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6 text-delulu-dark" />
          </button>
          <h1 className="font-black text-2xl text-delulu-dark tracking-tight">Delulu</h1>
        </div>
        <ConnectWallet />
      </div>
    </header>
  )
}

