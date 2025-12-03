"use client"

import Link from "next/link"
import { ConnectWallet } from "@/components/wallet"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-delulu-dark border-b border-white/5">
      <nav className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="text-2xl font-black text-white tracking-tighter">
            delulu
          </span>
          <span className="w-2 h-2 rounded-full bg-delulu-yellow" />
        </Link>
        
        {/* Wallet */}
        <ConnectWallet />
      </nav>
    </header>
  )
}
