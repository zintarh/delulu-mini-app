"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationsPanel } from "@/contexts/right-panel-context";
import {
  APP_HOME,
  getMobileBottomNavItems,
  hidesBottomNav,
  isMainNavItemActive,
  normalizePathname,
} from "@/components/main-nav-config";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

interface BottomNavProps {
  /** @deprecated Profile is not in main nav; kept for existing callers */
  onProfileClick?: () => void;
}

/**
 * Floating ink dock (redesign). Icon-only items; the centre "New contract"
 * item is a raised yellow tile. Height is mirrored by the
 * --mobile-bottom-nav-* vars in globals.css.
 */
export function BottomNav(_props: BottomNavProps = {}) {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const { authenticated } = useAuth();
  const { isOpen: notificationsOpen, close: closePanels } = useNotificationsPanel();

  const navItems = getMobileBottomNavItems(authenticated);
  const path = normalizePathname(pathname ?? "");
  const isHomeRoute = path === APP_HOME || (segment === "home" && path.startsWith(APP_HOME));

  useEffect(() => {
    [APP_HOME, "/rewards", "/explore", "/forfeit", "/profile"].forEach((href) => router.prefetch(href));
  }, [router]);

  const activeOptions = { isHomeRoute, notificationsOpen, layoutSegment: segment };

  if (hidesBottomNav(path)) return null;

  return (
    <nav
      className="fixed inset-x-5 z-50 mx-auto flex h-[68px] max-w-3xl items-center justify-around rounded-full bg-ink px-2 shadow-[0_18px_40px_-16px_rgba(22,22,21,0.55)] xl:max-w-3xl"
      style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 20px)" }}
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isMainNavItemActive(item, path, activeOptions);
        const isCreate = item.action === "forfeit";

        const cls = isCreate
          ? "-translate-y-[22px] active:scale-95 transition-transform flex h-[62px] w-[62px] items-center justify-center rounded-[20px] bg-yellow text-ink shadow-[0_0_0_6px_#f7f7f4]"
          : cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors touch-manipulation",
              isActive ? "bg-white text-ink" : "text-[#a3a39c] hover:text-white",
            );

        const icon = <Icon className={isCreate ? "h-7 w-7" : "h-[22px] w-[22px]"} strokeWidth={isCreate ? 2.6 : 2.2} />;

        if (item.href) {
          return (
            <Link
              key={item.action}
              href={item.href}
              onClick={() => closePanels()}
              onTouchStart={() => router.prefetch(item.href!)}
              className={cls}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              {icon}
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
              className={cls}
              aria-label={item.label}
            >
              {icon}
            </button>
          );
        }
        return null;
      })}
    </nav>
  );
}
