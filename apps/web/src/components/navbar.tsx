"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { ConnectWallet } from "@/components/wallet";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";
import { Search, User } from "lucide-react";

interface NavbarProps {
  onProfileClick?: () => void;
  activeTab?: "vision" | "fyp";
  onTabChange?: (tab: "vision" | "fyp") => void;
}

export function Navbar({
  onProfileClick,
  activeTab = "fyp",
  onTabChange,
}: NavbarProps) {
  const { isConnected } = useAccount();
  const { user } = useUserStore();
  const router = useRouter();

  const handleProfileClick = () => {
    onProfileClick?.();
  };

  const handleSearchClick = () => {
    router.push("/search");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-200">
      <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
        <button
          onClick={handleSearchClick}
          className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange?.("vision")}
            className={cn(
              "px- py-2 text-sm font-bold transition-colors relative",
              activeTab === "vision"
                ? "text-delulu-charcoal"
                : "text-gray-400 hover:text-delulu-charcoal"
            )}
          >
            Vision
            {activeTab === "vision" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
            )}
          </button>
          <button
            onClick={() => onTabChange?.("fyp")}
            className={cn(
              "px-2 py-2 text-sm font-medium transition-colors relative",
              activeTab === "fyp"
                ? "text-delulu-charcoal"
                : "text-gray-400 hover:text-delulu-charcoal"
            )}
          >
            For you
            {activeTab === "fyp" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
            )}
          </button>
        </div>
        {isConnected ? (
          <button
            onClick={handleProfileClick}
            className="flex items-center justify-center w-10 h-10 rounded-full transition-colors border border-gray-200 hover:bg-gray-50"
            aria-label="Profile"
          >
            {user?.pfpUrl ? (
              <img
                src={user.pfpUrl}
                alt={user.displayName || user.username || "Profile"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-gray-500" />
            )}
          </button>
        ) : (
          <ConnectWallet />
        )}
      </nav>
    </header>
  );
}
