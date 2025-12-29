"use client";

import { useAccount } from "wagmi";
import { useRouter, usePathname } from "next/navigation";
import { Home, Search, Plus, User, LogOut } from "lucide-react";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ConnectWallet } from "@/components/wallet";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
  onCreateClick?: () => void;
}

export function LeftSidebar({
  onProfileClick,
  onLogoutClick,
  onCreateClick,
}: LeftSidebarProps) {
  const { isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUserStore();

  const navItems = [
    {
      icon: Home,
      label: "Home",
      path: "/",
      active: pathname === "/",
    },
    {
      icon: Search,
      label: "Explore",
      path: "/delulus",
      active: pathname === "/delulus",
    },
    {
      icon: Plus,
      label: "Create",
      path: "/create",
      active: pathname === "/create",
      onClick: onCreateClick,
    },
    {
      icon: User,
      label: "Profile",
      path: "/profile",
      active: pathname === "/profile",
      onClick: onProfileClick,
    },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.onClick) {
      item.onClick();
    } else {
      router.push(item.path);
    }
  };

  return (
    <aside className="h-screen flex flex-col px-3 py-4 border-r border-gray-800 bg-black">
      <div className="mb-8 px-3">
        <h1 className="text-2xl font-black text-white">Delulu</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors text-left",
                item.active
                  ? "bg-gray-900 text-white font-bold"
                  : "text-white/60 hover:bg-gray-900/50 hover:text-white"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xl">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        {isConnected ? (
          <button
            onClick={onProfileClick}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors text-left",
              pathname === "/profile"
                ? "bg-gray-900 text-white font-bold"
                : "text-white/60 hover:bg-gray-900/50 hover:text-white"
            )}
          >
            {user?.pfpUrl ? (
              <img
                src={user.pfpUrl}
                alt={user.displayName || user.username || "Profile"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold truncate">
                {user?.displayName || user?.username || "Profile"}
              </p>
              {user?.username && (
                <p className="text-sm text-white/50 truncate">
                  @{user.username}
                </p>
              )}
            </div>
          </button>
        ) : (
          <div className="px-3">
            <ConnectWallet />
          </div>
        )}
      </div>
    </aside>
  );
}
