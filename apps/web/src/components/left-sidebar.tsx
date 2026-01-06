"use client";

import { usePathname } from "next/navigation";
import { Home, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

export function LeftSidebar({
  onProfileClick,
  onCreateClick,
}: LeftSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      icon: Home,
      label: "Home",
      active: pathname === "/",
      onClick: undefined as (() => void) | undefined,
    },
    {
      icon: Plus,
      label: "Create",
      active: false,
      onClick: onCreateClick,
    },
    {
      icon: User,
      label: "Profile",
      active: false,
      onClick: onProfileClick,
    },
  ];

  return (
    <aside className="h-screen sticky top-0 flex flex-col px-3 py-4 border-r border-gray-200 bg-white">
      <div className="mb-8 px-3">
        <h1 
          className="text-4xl font-black text-delulu-yellow-reserved"
          style={{
            fontFamily: "var(--font-gloria), cursive",
            textShadow: "3px 3px 0px #1A1A1A, -2px -2px 0px #1A1A1A, 2px -2px 0px #1A1A1A, -2px 2px 0px #1A1A1A"
          }}
        >
          Delulu
        </h1>
      </div>

      <nav className="flex-1 flex flex-col gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              title={item.label}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                item.active
                  ? "bg-gray-200 text-delulu-charcoal"
                  : "text-gray-500 hover:bg-gray-100 hover:text-delulu-charcoal"
              )}
              aria-label={item.label}
            >
              <Icon className="w-8 h-8" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
