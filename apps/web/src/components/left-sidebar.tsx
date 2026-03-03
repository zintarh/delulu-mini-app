"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Plus, User, Coins, User2, Trophy } from "lucide-react";
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
  const { isAdmin } = useIsAdmin();

  const navItems = [
    {
      icon: Home,
      label: "Home",
      href: "/",
      active: pathname === "/",
      onClick: undefined as (() => void) | undefined,
    },
    {
      icon: Plus,
      label: "Create",
      href: undefined,
      active: false,
      onClick: onCreateClick,
    },
    {
      icon: Coins,
      label: "Claim G$",
      href: "/daily-claim",
      active: pathname === "/daily-claim",
      onClick: undefined,
    },
    {
      icon: Trophy,
      label: "Challenges",
      href: "/challenges",
      active: pathname === "/challenges",
      onClick: undefined,
    },
    {
      icon: User,
      label: "Profile",
      href: undefined,
      active: false,
      onClick: onProfileClick,
    },
    ...(isAdmin
      ? [
          {
            icon: User2,
            label: "Markets",
            href: "/market",
            active: pathname === "/market",
            onClick: undefined,
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
          const className = cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full",
            item.active
              ? isClaimG
                ? "bg-[#01B1FF]/20"
                : "bg-gray-200 text-delulu-charcoal"
              : isClaimG
              ? "hover:bg-[#01B1FF]/10"
              : "text-gray-500 hover:bg-gray-100 hover:text-delulu-charcoal"
          );
          const style = isClaimG ? { color: "#01B1FF" } : undefined;
          const content = (
            <>
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
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={className}
                style={style}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={className}
              style={style}
              aria-label={item.label}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
