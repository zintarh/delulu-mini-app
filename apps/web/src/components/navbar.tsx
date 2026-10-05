"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { Wordmark } from "@/components/wordmark";
import { Bolt, Flame, HudPill } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import { useNotificationCount } from "@/contexts/notification-count-context";
import { formatCompact, getLevel } from "@/lib/levels";

interface NavbarProps {
  onLogoutClick?: () => void;
}

/**
 * Mobile top HUD (redesign): avatar + level badge, streak, points, alerts.
 * Guests see the wordmark and the account menu (sign in).
 */
export function Navbar({ onLogoutClick }: NavbarProps) {
  const { authenticated, address } = useAuth();
  const { currentStreak } = useUserStreak(authenticated ? address : undefined);
  const { points } = useUserTotalPoints(authenticated ? address : undefined);
  const { toggle: toggleNotifications } = useNotificationsPanel();
  const { unreadCount } = useNotificationCount();
  const { level } = getLevel(points ?? 0);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-paper/95 backdrop-blur-sm">
      <nav className="mx-auto flex min-h-[64px] max-w-lg items-center gap-2 px-5 py-3 md:max-w-7xl md:px-6">
        {authenticated ? (
          <div className="relative shrink-0">
            <NavbarProfileMenu onLogoutClick={onLogoutClick} size="compact" />
            <span
              className="pointer-events-none absolute -bottom-1 -right-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-[7px] border-2 border-white bg-blue px-1 text-[11px] font-extrabold text-white"
              aria-label={`Level ${level}`}
            >
              {level}
            </span>
          </div>
        ) : (
          <Link href="/" aria-label="Delulu" className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark size={22} />
          </Link>
        )}

        <div className="flex-1" />

        {authenticated ? (
          <>
            <Link href="/streaks" aria-label={`${currentStreak} day streak`}>
              <HudPill>
                <Flame size={20} />
                {currentStreak}
              </HudPill>
            </Link>
            <Link href="/leaderboard" aria-label={`${points ?? 0} points`}>
              <HudPill>
                <Bolt size={18} />
                {formatCompact(points ?? 0)}
              </HudPill>
            </Link>
            <button type="button" onClick={toggleNotifications} aria-label="Notifications">
              <HudPill className="px-[9px]">
                <Bell className="h-5 w-5" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-paper bg-orange px-1 text-[10px] font-extrabold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </HudPill>
            </button>
          </>
        ) : (
          <NavbarProfileMenu onLogoutClick={onLogoutClick} size="compact" />
        )}
      </nav>
    </header>
  );
}

