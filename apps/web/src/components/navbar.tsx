"use client"

import Link from "next/link"
import { useAccount } from "wagmi"
import { ConnectWallet } from "@/components/wallet"
import { ProfileDropdown } from "@/components/profile-dropdown"

interface NavbarProps {
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
}

export function Navbar({ onProfileClick, onLogoutClick }: NavbarProps) {
  const { isConnected } = useAccount()
  
  return (
    <header className="sticky top-0 z-50 w-full bg-delulu-dark backdrop-blur-sm border-b border-white/10">
      <nav className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="text-2xl font-black text-delulu-yellow tracking-tighter" style={{ fontFamily: "var(--font-gloria), cursive" }}>
            delulu
          </span>
          <span className="w-2 h-2 rounded-full bg-delulu-yellow" />
        </Link>
        
        {/* Wallet or Profile Dropdown */}
        {isConnected ? (
          <ProfileDropdown 
            onProfileClick={onProfileClick || (() => {})} 
            onLogoutClick={onLogoutClick || (() => {})}
          />
        ) : (
          <ConnectWallet />
        )}
      </nav>
    </header>
  )
}
