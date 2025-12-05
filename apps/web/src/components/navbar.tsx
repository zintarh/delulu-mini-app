"use client"

import Link from "next/link"
import { useAccount } from "wagmi"
import { ConnectWallet } from "@/components/wallet"
import { useUserStore } from "@/stores/useUserStore"

interface NavbarProps {
  onProfileClick?: () => void;
}

export function Navbar({ onProfileClick }: NavbarProps) {
  const { isConnected } = useAccount()
  const { user, isLoading } = useUserStore()
  
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
        
        {/* Wallet or Profile Avatar */}
        {isConnected ? (
          <button
            onClick={onProfileClick}
            className="flex items-center justify-center transition-transform active:scale-95"
            aria-label="Open profile"
          >
            {isLoading ? (
              <div className="w-9 h-9 rounded-full bg-delulu-dark/20 animate-pulse" />
            ) : user ? (
              user.pfpUrl ? (
                <img 
                  src={user.pfpUrl} 
                  alt={user.displayName || user.username || "Profile"} 
                  className="w-9 h-9 rounded-full object-cover border-2 border-delulu-dark/20 hover:border-delulu-dark/40 transition-colors"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-delulu-dark flex items-center justify-center border-2 border-delulu-dark/20 hover:border-delulu-dark/40 transition-colors">
                  <span className="text-sm font-black text-delulu-yellow">
                    {(user.displayName || user.username || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-full bg-delulu-dark/20 flex items-center justify-center border-2 border-delulu-dark/20">
                <span className="text-sm font-black text-delulu-dark/40">?</span>
              </div>
            )}
          </button>
        ) : (
          <ConnectWallet />
        )}
      </nav>
    </header>
  )
}
