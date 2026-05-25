"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useClaimPanel, useNotificationsPanel } from "@/contexts/right-panel-context";
import { prefetchCreateManifestStep } from "@/components/create-delusion-content";
import {
  getMobileBottomNavItems,
  isMainNavItemActive,
  normalizePathname,
} from "@/components/main-nav-config";
import { MOBILE_BOTTOM_NAV_HEIGHT } from "@/lib/mobile-bottom-nav";

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
  const { isOpen: notificationsOpen } = useNotificationsPanel();
  const { isOpen: claimOpen, toggle: toggleClaim, close: closePanels } =
    useClaimPanel();

  const navItems = getMobileBottomNavItems(authenticated);
  const path = normalizePathname(pathname ?? "");
  const isHomeRoute = segment === null && path === "/";

  useEffect(() => {
    ["/", "/board", "/explore", "/profile"].forEach((href) => router.prefetch(href));
    void import("@/components/create-delusion-content");
    prefetchCreateManifestStep();
  }, [router]);

  const prefetchCreate = () => {
    router.prefetch("/board");
    void import("@/components/create-delusion-content");
    prefetchCreateManifestStep();
  };

  const activeOptions = {
    isHomeRoute,
    notificationsOpen,
    claimOpen,
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

            const content = (
              <span className="flex flex-col items-center gap-0.5 py-1 min-w-[52px] max-w-[72px]">
                <Icon
                  className={cn(
                    "w-6 h-6 flex-shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                  strokeWidth={2}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight truncate w-full text-center",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label === "Claim G$" ? "Claim" : item.label}
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
                  onClick={() => router.push("/sign-in")}
                  className={itemClass}
                  aria-label={item.label}
                >
                  {content}
                </button>
              );
            }

            if (item.action === "claim") {
              return (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => {
                    closePanels();
                    toggleClaim();
                  }}
                  className={itemClass}
                  aria-label={item.label}
                  aria-expanded={claimOpen}
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
