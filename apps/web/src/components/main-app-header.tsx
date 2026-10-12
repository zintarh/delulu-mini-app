"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { hidesBottomNav } from "@/components/main-nav-config";

export type HeaderConfig = {
  showNavbar: boolean;
};

/**
 * One shape at every width now — desktop renders whatever mobile does, no
 * separate desktop-only header. See docs/redesign/screens for per-page
 * titles on routes that own their own header instead of this one.
 */
function getHeaderConfig(pathname: string): HeaderConfig | null {
  // Delulu detail renders its own header (back, share) at every width.
  if (/^\/delulu\/[^/]+$/.test(pathname)) {
    return null;
  }

  // Create flow: owns its own title bar at every width.
  if (pathname.startsWith("/board")) {
    return { showNavbar: false };
  }

  // Flex card owns its own back bar.
  if (pathname === "/profile/flex") {
    return { showNavbar: false };
  }

  // Forfeit create flow owns its own back / Next header.
  if (pathname.startsWith("/forfeit")) {
    return { showNavbar: false };
  }

  // The HUD (avatar, streak, balance, alerts) tops Home, Rewards, and
  // Campaigns (/explore + a single campaign) at every width; every other
  // screen starts with its own title instead.
  const hud =
    pathname === "/home" ||
    pathname.startsWith("/rewards") ||
    pathname.startsWith("/wallet") ||
    pathname.startsWith("/explore") ||
    /^\/communities\/[^/]+\/campaigns\/[^/]+$/.test(pathname);
  return { showNavbar: hud };
}

/** Routes that own an inner scroll container (infinite scroll, PTR, create flow). */
export function usesNestedScroll(pathname: string): boolean {
  return (
    pathname.startsWith("/explore") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/board") ||
    pathname.startsWith("/forfeit") ||
    /^\/delulu\/[^/]+$/.test(pathname)
  );
}

/**
 * Full padding clearance for pages that render their own BottomNav
 * (outside the main layout spacer). Prefer the layout spacer instead.
 */
export const MOBILE_BOTTOM_NAV_CLEARANCE =
  "pb-[calc(var(--mobile-bottom-nav-clearance)+20px)]";

/**
 * Reserves space under the main column so fixed BottomNav never covers
 * scroll content. Matches bar height + a little breathing room.
 */
export function MobileBottomNavSpacer() {
  const pathname = usePathname() ?? "";
  if (hidesBottomNav(pathname)) return null;
  return (
    <div
      className="shrink-0"
      style={{ height: "var(--mobile-bottom-nav-clearance)" }}
      aria-hidden
    />
  );
}

/** Shared navbar for main app routes — same header at every width. */
export function MainAppHeader() {
  const pathname = usePathname() ?? "";
  const config = getHeaderConfig(pathname);
  if (!config?.showNavbar) return null;
  return <Navbar />;
}

/** Standard page shell — scroll is handled by MainAppContent unless nested-scroll route. */
export function MainPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <main className={cn("bg-background", className)}>{children}</main>;
}

/**
 * Offsets fixed mobile top navbar; scroll container for most routes.
 * Bottom clearance comes from MobileBottomNavSpacer in the main layout
 * (scroll viewport ends above the fixed nav).
 */
export function MainAppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const config = getHeaderConfig(pathname);
  const needsMobileNavOffset = config?.showNavbar ?? false;
  const nestedScroll = usesNestedScroll(pathname);

  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        nestedScroll ? "flex flex-col overflow-hidden" : "overflow-y-auto scrollbar-hide",
        needsMobileNavOffset && "pt-[var(--mobile-top-nav-bar)]",
      )}
    >
      {children}
    </div>
  );
}
