"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Bell, Compass, Home, LogIn, Plus, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lulu } from "@/components/ds/art";
import { Wordmark } from "@/components/wordmark";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/hooks/use-auth";
import { usePfp } from "@/hooks/use-profile-pfp";
import { useUserStore } from "@/stores/useUserStore";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import { useNotificationCount } from "@/contexts/notification-count-context";
import { preloadAuthProviders } from "@/lib/auth-session-hint";
import {
  APP_HOME,
  getLeaderboardNavItem,
  getRewardsNavItem,
  isMainNavItemActive,
  isNavHrefActive,
  normalizePathname,
  type MainNavItem,
} from "@/components/main-nav-config";

/**
 * Desktop-only app navigation (lg+). Mobile keeps the floating dock
 * (bottom-nav.tsx) untouched — this renders nothing below lg.
 *
 *   lg  (1024–1279): icon rail, labels as hover tooltips
 *   xl  (1280+):     full sidebar with labels
 *
 * Width is mirrored by --desktop-sidebar-w in globals.css so viewport-fixed
 * bars and toasts can centre on the content column instead of the window.
 */
const PAGES: MainNavItem[] = [
  { icon: Home, label: "Home", href: APP_HOME, action: "home" },
  { icon: Compass, label: "Campaigns", href: "/explore", action: "explore" },
  getLeaderboardNavItem(),
  getRewardsNavItem(),
];

function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[200] -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 xl:hidden">
      {label}
    </span>
  );
}

const rowCls = (active: boolean) =>
  cn(
    "relative flex h-12 w-12 items-center justify-center gap-3 rounded-2xl text-[15px] font-bold transition-colors xl:w-full xl:justify-start xl:px-3.5",
    active ? "bg-ink text-white" : "text-ink/60 hover:bg-line/60 hover:text-ink",
  );

function RowInner({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <>
      <span className="relative shrink-0">
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2.1} />
        {badge ? (
          <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-paper bg-orange px-1 text-[10px] font-extrabold leading-none text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="hidden xl:inline">{label}</span>
    </>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const { authenticated, address } = useAuth();
  const user = useUserStore((s) => s.user);
  const pfp = usePfp(authenticated ? address ?? undefined : undefined);
  const { isOpen: notificationsOpen, toggle: toggleNotifications, close: closePanels } =
    useNotificationsPanel();
  const { unreadCount } = useNotificationCount();

  const path = normalizePathname(pathname ?? "");
  const activeOptions = {
    isHomeRoute: path === APP_HOME,
    notificationsOpen,
    layoutSegment: segment,
  };

  useEffect(() => {
    [APP_HOME, "/explore", "/leaderboard", "/rewards", "/forfeit", "/profile"].forEach((h) =>
      router.prefetch(h),
    );
  }, [router]);

  const toSignIn = () => {
    preloadAuthProviders();
    router.push("/sign-in");
  };

  const creating = isNavHrefActive(path, "/forfeit");
  const profileActive = isNavHrefActive(path, "/profile") && !notificationsOpen;
  const settingsActive = isNavHrefActive(path, "/settings");
  const displayName =
    user?.displayName?.trim() ||
    user?.username ||
    (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Your account");

  return (
    <aside
      className="relative z-30 hidden h-full w-[var(--desktop-sidebar-w)] shrink-0 flex-col items-center border-r-2 border-line bg-white px-4 py-6 lg:flex xl:items-stretch xl:px-5"
      aria-label="App navigation"
    >
      <Link
        href={APP_HOME}
        aria-label="Delulu home"
        onClick={() => closePanels()}
        className="mb-7 flex h-12 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring xl:justify-start xl:px-1.5"
      >
        <span className="xl:hidden">
          <Lulu size={40} />
        </span>
        <span className="hidden xl:inline-flex">
          <Wordmark size={26} />
        </span>
      </Link>

      {/* Primary action — mirrors the dock's raised yellow tile. */}
      <div className="group relative mb-6 xl:w-full">
        <Link
          href={authenticated ? "/forfeit" : "/sign-in"}
          onClick={(e) => {
            closePanels();
            if (!authenticated) {
              e.preventDefault();
              toSignIn();
            }
          }}
          aria-label="New contract"
          aria-current={creating ? "page" : undefined}
          className={cn(
            "press-edge flex h-12 w-12 items-center justify-center gap-2 rounded-2xl bg-yellow text-ink shadow-edge-yellow xl:h-[52px] xl:w-full",
            creating && "ring-2 ring-ink ring-offset-2",
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={2.8} />
          <span className="hidden text-[14px] font-extrabold uppercase tracking-[0.06em] xl:inline">
            New contract
          </span>
        </Link>
        <Tip label="New contract" />
      </div>

      <nav className="flex flex-col items-center gap-1.5 xl:items-stretch">
        {PAGES.map((item) => {
          const active = isMainNavItemActive(item, path, activeOptions) && !notificationsOpen;
          return (
            <div key={item.action} className="group relative">
              <Link
                href={item.href!}
                onClick={() => closePanels()}
                onMouseEnter={() => router.prefetch(item.href!)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={rowCls(active)}
              >
                <RowInner icon={item.icon} label={item.label} active={active} />
              </Link>
              <Tip label={item.label} />
            </div>
          );
        })}

        <div className="group relative">
          <button
            type="button"
            onClick={() => (authenticated ? toggleNotifications() : toSignIn())}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            className={rowCls(notificationsOpen)}
          >
            <RowInner
              icon={Bell}
              label="Notifications"
              active={notificationsOpen}
              badge={authenticated ? unreadCount : 0}
            />
          </button>
          <Tip label="Notifications" />
        </div>
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5 pt-6 xl:items-stretch">
        {authenticated ? (
          <>
            <div className="group relative">
              <Link
                href="/settings"
                onClick={() => closePanels()}
                aria-label="Settings"
                aria-current={settingsActive ? "page" : undefined}
                className={rowCls(settingsActive)}
              >
                <RowInner icon={Settings} label="Settings" active={settingsActive} />
              </Link>
              <Tip label="Settings" />
            </div>

            <div className="group relative">
              <Link
                href="/profile"
                onClick={() => closePanels()}
                aria-label="Profile"
                aria-current={profileActive ? "page" : undefined}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors xl:h-14 xl:w-full xl:justify-start xl:gap-3 xl:px-2",
                  profileActive ? "bg-yellow-soft ring-2 ring-yellow-line" : "hover:bg-line/60",
                )}
              >
                <UserAvatar
                  address={address ?? "0x0000"}
                  username={user?.username}
                  pfpUrl={pfp || user?.pfpUrl || null}
                  size={36}
                />
                <span className="hidden min-w-0 flex-1 truncate text-[14px] font-bold text-ink xl:block">
                  {displayName}
                </span>
              </Link>
              <Tip label="Profile" />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={toSignIn}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-[14px] font-extrabold text-white xl:w-full"
          >
            <LogIn className="h-5 w-5 xl:hidden" strokeWidth={2.4} aria-hidden />
            <span className="sr-only xl:not-sr-only">Sign in</span>
          </button>
        )}
      </div>
    </aside>
  );
}
