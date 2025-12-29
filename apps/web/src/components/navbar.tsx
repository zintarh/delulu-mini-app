"use client";

import { useAccount } from "wagmi";
import { ConnectWallet } from "@/components/wallet";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface NavbarProps {
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
  activeTab?: "vision" | "fyp";
  onTabChange?: (tab: "vision" | "fyp") => void;
}

export function Navbar({
  onProfileClick,
  onLogoutClick,
  activeTab = "fyp",
  onTabChange,
}: NavbarProps) {
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 w-full bg-black">
      <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
        {isConnected ? (
          <ProfileDropdown
            onProfileClick={onProfileClick || (() => {})}
            onLogoutClick={onLogoutClick || (() => {})}
          />
        ) : (
          <ConnectWallet />
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange?.("vision")}
            className={cn(
              "px-2 py-2 text-base font-bold transition-colors relative",
              activeTab === "vision"
                ? "text-white"
                : "text-white/60 hover:text-white"
            )}
          >
            Vision
            {activeTab === "vision" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-yellow-reserved" />
            )}
          </button>
          <button
            onClick={() => onTabChange?.("fyp")}
            className={cn(
              "px-2 py-2 text-base font-medium transition-colors relative",
              activeTab === "fyp"
                ? "text-white"
                : "text-white/60 hover:text-white"
            )}
          >
            For you
            {activeTab === "fyp" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-delulu-yellow-reserved" />
            )}
          </button>
        </div>

        <button className="flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </button>
      </nav>
    </header>
  );
}
