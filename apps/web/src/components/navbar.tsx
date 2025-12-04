"use client"

import Link from "next/link"
import { useAccount } from "wagmi"
import { WalletConnectButton } from "@/components/connect-button"

export function Navbar() {
  const { isConnected } = useAccount()
  
  return (
    <header className="sticky top-0 z-50 w-full bg-delulu-yellow/80 backdrop-blur-sm border-b border-delulu-dark/10">
      <nav className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="text-2xl font-black text-delulu-dark tracking-tighter">
            delulu
          </span>
          <span className="w-2 h-2 rounded-full bg-delulu-dark" />
        </Link>
        
        {/* Wallet or Profile Link */}
        {isConnected ? (
          <Link href="/profile" className="text-sm font-bold text-delulu-dark hover:text-delulu-dark/70 transition-colors">
            Profile
          </Link>
        ) : (
          <WalletConnectButton />
        )}
      </nav>
    </header>
  )
}
