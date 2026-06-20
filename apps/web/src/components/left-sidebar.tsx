"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import { useNotificationCount } from "@/contexts/notification-count-context";
import { prefetchCreateManifestStep, prefetchCreateDelusionContent } from "@/lib/prefetch-create-manifest";
import {
  getMainNavItems,
  getProfileNavItem,
  isMainNavItemActive,
  normalizePathname,
} from "@/components/main-nav-config";
import { preloadAuthProviders } from "@/lib/auth-session-hint";
import { prefetchExploreOnIntent } from "@/lib/prefetch-explore-feed";

function Tooltip({ label }: { label: string }) {
  return (
    <span className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md z-[200]">
      {label}
    </span>
  );
}

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <Icon
      className={cn(
        "h-7 w-7 transition-colors",
        active ? "text-delulu-blue" : "text-primary",
      )}
      strokeWidth={active ? 2.25 : 2}
      fill="none"
    />
  );
}

interface LeftSidebarProps {
  onCreateClick?: () => void | Promise<void>;
}

export function LeftSidebar({ onCreateClick }: LeftSidebarProps = {}) {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const { authenticated } = useAuth();
  const {
    isOpen: notificationsOpen,
    toggle: toggleNotifications,
    close: closePanels,
  } = useNotificationsPanel();
  const { unreadCount } = useNotificationCount();

  useEffect(() => {
    ["/", "/board", "/explore", "/profile", "/leaderboard"].forEach((href) => router.prefetch(href));
    const schedule = () => {
      prefetchCreateDelusionContent();
      prefetchCreateManifestStep();
      prefetchExploreOnIntent();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(schedule, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(schedule, 1500);
    return () => window.clearTimeout(timer);
  }, [router]);

  const prefetchCreate = () => {
    router.prefetch("/board");
    prefetchCreateDelusionContent();
    prefetchCreateManifestStep();
  };

  const path = normalizePathname(pathname ?? "");
  const isHomeRoute = segment === null && path === "/";
  const navItems = getMainNavItems(authenticated);
  const profileItem = getProfileNavItem(authenticated);
  const profileActive = isMainNavItemActive(profileItem, path, {
    isHomeRoute,
    notificationsOpen,
    layoutSegment: segment,
  });

  const activeOptions = {
    isHomeRoute,
    notificationsOpen,
    layoutSegment: segment,
  };

  const itemCls = (active: boolean) =>
    cn(
      "flex items-center justify-center w-14 h-14 rounded-xl border border-transparent transition-all",
      active
        ? "border-delulu-blue-border bg-delulu-blue-light"
        : "hover:bg-secondary/80",
    );

  return (
    <aside className="h-full flex flex-col items-center py-6 border-r border-border bg-background w-24">
      <div className="mb-8">
        <Link
          href="/"
          aria-label="Delulu home"
          className="flex items-center justify-center w-14 h-14"
          onClick={() => closePanels()}
        >
          <Image
            src="/favicon_io/android-chrome-192x192.png"
            alt="Delulu"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
          />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-4">
        {navItems.map((item) => {
          const { icon, label, href, action } = item;
          const active = isMainNavItemActive(item, path, activeOptions);

          const handlePanelAction = () => {
            if (action === "notifications") {
              toggleNotifications();
            }
          };

          const showBadge = action === "notifications" && unreadCount > 0;

          return (
            <div key={action} className="group relative">
              {action === "create" && onCreateClick ? (
                <button
                  type="button"
                  onClick={() => {
                    closePanels();
                    void onCreateClick();
                  }}
                  onMouseEnter={prefetchCreate}
                  className={itemCls(active)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon icon={icon} active={active} />
                </button>
              ) : href ? (
                <Link
                  href={href}
                  className={itemCls(active)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => closePanels()}
                  onMouseEnter={() => {
                    router.prefetch(href);
                    if (action === "explore") prefetchExploreOnIntent();
                  }}
                  onTouchStart={() => {
                    router.prefetch(href);
                    if (action === "explore") prefetchExploreOnIntent();
                  }}
                >
                  <NavIcon icon={icon} active={active} />
                </Link>
              ) : authenticated ? (
                <button
                  type="button"
                  onClick={handlePanelAction}
                  onMouseEnter={action === "create" ? prefetchCreate : undefined}
                  className={itemCls(active)}
                  aria-label={label}
                  aria-expanded={
                    action === "notifications" ? notificationsOpen : undefined
                  }
                >
                  <span className="relative">
                    <NavIcon icon={icon} active={active} />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    preloadAuthProviders();
                    router.push("/sign-in");
                  }}
                  className={itemCls(active)}
                  aria-label={label}
                >
                  <NavIcon icon={icon} active={active} />
                </button>
              )}
              <Tooltip label={label} />
            </div>
          );
        })}
      </nav>

      <div className="group relative mt-auto pt-4">
        {profileItem.href ? (
          <Link
            href={profileItem.href}
            className={itemCls(profileActive)}
            aria-label={profileItem.label}
            aria-current={profileActive ? "page" : undefined}
            onClick={() => closePanels()}
            onMouseEnter={() => router.prefetch(profileItem.href!)}
          >
            <NavIcon icon={profileItem.icon} active={profileActive} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              preloadAuthProviders();
              router.push("/sign-in");
            }}
            className={itemCls(profileActive)}
            aria-label={profileItem.label}
          >
            <NavIcon icon={profileItem.icon} active={profileActive} />
          </button>
        )}
        <Tooltip label={profileItem.label} />
      </div>
    </aside>
  );
}
