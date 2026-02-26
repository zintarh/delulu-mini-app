"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, User, Coins, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";

interface LeftSidebarProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

export function LeftSidebar({
  onProfileClick,
  onCreateClick,
}: LeftSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useIsAdmin();

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
      icon: Coins,
      label: "Claim G$",
      active: pathname === "/daily-claim",
      onClick: () => {
        window.location.href = "/daily-claim";
      },
    },
    {
      icon: User,
      label: "Profile",
      active: false,
      onClick: onProfileClick,
    },
    ...(isAdmin
      ? [
          {
            icon:  User2 ,
            label: "Markets",
            active: pathname === "/market",
            onClick: () => {
              router.push("/market");
            },
          },
        ]
      : []),
  ];

  return (
    <aside className="h-screen sticky top-0 flex flex-col px-4 py-4 border-r border-gray-200 bg-white">
      <div className="mb-8 px-2">
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

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isClaimG = item.label === "Claim G$";
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full",
                item.active
                  ? isClaimG
                    ? "bg-[#01B1FF]/20"
                    : "bg-gray-200 text-delulu-charcoal"
                  : isClaimG
                  ? "hover:bg-[#01B1FF]/10"
                  : "text-gray-500 hover:bg-gray-100 hover:text-delulu-charcoal"
              )}
              style={isClaimG ? { color: "#01B1FF" } : undefined}
              aria-label={item.label}
            >
              {isClaimG ? (
                <img
                  src="/gooddollar-logo.png"
                  alt="G$"
                  className="w-6 h-6 flex-shrink-0 object-contain"
                />
              ) : (
                <Icon className="w-6 h-6 flex-shrink-0" />
              )}
              <span className="text-base font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
