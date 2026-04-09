"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Plus, Coins, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";

interface BottomNavProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

const navItems: Array<{
  icon: typeof Home;
  label: string;
  href: string | null;
  isClaim?: boolean;
}> = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Plus, label: "Create", href: null },
  { icon: Coins, label: "Claim", href: "/daily-claim", isClaim: true },
  { icon: User, label: "Profile", href: null },
];

export function BottomNav({ onProfileClick, onCreateClick }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    ["/", "/board", "/profile", "/daily-claim", "/leaderboard"]
      .forEach((href) => router.prefetch(href));
  }, [router]);

  return (
    <>
      {/* Reserve space so fixed mobile nav never overlaps page content. */}
      <div
        className="lg:hidden"
        style={{ height: "calc(56px + max(env(safe-area-inset-bottom), 8px))" }}
        aria-hidden="true"
      />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href
            ? item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
            : pathname.startsWith("/profile") && item.label === "Profile";
          const isClaim = item.isClaim === true;

          const content = (
            <span className="flex flex-col items-center gap-0.5 py-1 min-w-[56px]">
              {isClaim ? (
                <img
                  src="/gooddollar-logo.png"
                  alt=""
                  className={cn(
                    "w-6 h-6 flex-shrink-0 object-contain",
                    isActive && "opacity-100"
                  )}
                />
              ) : (
                <Icon
                  className={cn(
                    "w-6 h-6 flex-shrink-0 transition-colors",
                    isActive
                      ? isClaim
                        ? "text-[#01B1FF]"
                        : "text-foreground"
                      : "text-muted-foreground"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  isActive
                    ? isClaim
                      ? "text-[#01B1FF]"
                      : "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </span>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                onMouseEnter={() => router.prefetch(item.href!)}
                onTouchStart={() => router.prefetch(item.href!)}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-colors touch-manipulation",
                  isActive ? "bg-secondary/80" : "hover:bg-muted/60 active:bg-muted"
                )}
                style={isClaim && isActive ? { color: "#01B1FF" } : undefined}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          if (isConnected && item.label === "Create") {
            return (
              <Link
                key={item.label}
                href="/board"
                onMouseEnter={() => router.prefetch("/board")}
                onTouchStart={() => router.prefetch("/board")}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-colors touch-manipulation",
                  isActive ? "bg-secondary/80" : "hover:bg-muted/60 active:bg-muted"
                )}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          if (isConnected && item.label === "Profile") {
            return (
              <Link
                key={item.label}
                href="/profile"
                onMouseEnter={() => router.prefetch("/profile")}
                onTouchStart={() => router.prefetch("/profile")}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-colors touch-manipulation",
                  isActive ? "bg-secondary/80" : "hover:bg-muted/60 active:bg-muted"
                )}
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          const handleClick = () => {
            if (item.label === "Profile") onProfileClick?.();
            if (item.label === "Create") onCreateClick?.();
          };

          return (
            <button
              key={item.label}
              type="button"
              onClick={handleClick}
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors touch-manipulation",
                isActive ? "bg-secondary/80" : "hover:bg-muted/60 active:bg-muted"
              )}
              aria-label={item.label}
            >
              {content}
            </button>
          );
        })}
        </div>
      </nav>
    </>
  );
}
