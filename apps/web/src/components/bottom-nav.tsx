"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import { useNotificationCount } from "@/contexts/notification-count-context";
import { prefetchCreateManifestStep, prefetchCreateDelusionContent } from "@/lib/prefetch-create-manifest";
import {
  getMobileBottomNavItems,
  isMainNavItemActive,
  normalizePathname,
} from "@/components/main-nav-config";
import { MOBILE_BOTTOM_NAV_HEIGHT } from "@/lib/mobile-bottom-nav";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

interface BottomNavProps {
  /** @deprecated Profile is not in main nav; kept for existing callers */
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

export function BottomNav({ onCreateClick }: BottomNavProps) {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const { authenticated } = useAuth();
  const { isOpen: notificationsOpen, toggle: toggleNotifications, close: closePanels } = useNotificationsPanel();
  const { unreadCount } = useNotificationCount();

  const navItems = getMobileBottomNavItems(authenticated);
  const path = normalizePathname(pathname ?? "");
  const isHomeRoute = segment === null && path === "/";

  useEffect(() => {
    ["/", "/board", "/explore", "/profile"].forEach((href) => router.prefetch(href));
    const schedule = () => {
      prefetchCreateDelusionContent();
      prefetchCreateManifestStep();
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

  const activeOptions = {
    isHomeRoute,
    notificationsOpen,
    layoutSegment: segment,
  };

  return (
    <>
      <div
        className="lg:hidden"
        style={{ height: MOBILE_BOTTOM_NAV_HEIGHT }}
        aria-hidden="true"
      />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-14 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isMainNavItemActive(item, path, activeOptions);

            const showBadge = item.action === "notifications" && unreadCount > 0;

            const content = (
              <span className="flex flex-col items-center gap-0.5 py-1 min-w-[52px] max-w-[72px]">
                <span className="relative">
                  <Icon
                    className={cn(
                      "w-6 h-6 flex-shrink-0 transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    strokeWidth={2}
                  />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight truncate w-full text-center",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </span>
            );

            const itemClass = cn(
              "flex flex-1 items-center justify-center rounded-lg transition-colors touch-manipulation min-w-0",
              isActive ? "bg-secondary/80" : "hover:bg-muted/60 active:bg-muted",
            );

            if (item.href) {
              return (
                <Link
                  key={item.action}
                  href={item.href}
                  onClick={() => {
                    closePanels();
                    if (item.action === "create" && onCreateClick) onCreateClick();
                  }}
                  onMouseEnter={() => {
                    router.prefetch(item.href!);
                    if (item.action === "create") prefetchCreate();
                  }}
                  onTouchStart={() => {
                    router.prefetch(item.href!);
                    if (item.action === "create") prefetchCreate();
                  }}
                  className={itemClass}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                >
                  {content}
                </Link>
              );
            }

            if (!authenticated) {
              return (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    preloadAuthProviders();
                    router.push("/sign-in");
                  }}
                  className={itemClass}
                  aria-label={item.label}
                >
                  {content}
                </button>
              );
            }

            if (item.action === "notifications") {
              return (
                <button
                  key={item.action}
                  type="button"
                  onClick={toggleNotifications}
                  className={itemClass}
                  aria-label={item.label}
                  aria-expanded={notificationsOpen}
                >
                  {content}
                </button>
              );
            }

            return null;
          })}
        </div>
      </nav>
    </>
  );
}
