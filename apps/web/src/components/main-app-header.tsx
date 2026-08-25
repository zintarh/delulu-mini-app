"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { MainDesktopHeader } from "@/components/main-desktop-header";
import { cn } from "@/lib/utils";

export type HeaderConfig = {
  mobile: boolean;
  desktop: boolean;
};

function getHeaderConfig(pathname: string): HeaderConfig | null {
  // Delulu detail renders its own mobile + desktop header (back, share).
  if (/^\/delulu\/[^/]+$/.test(pathname)) {
    return null;
  }

  // Create flow: custom mobile title bar; desktop still gets the header.
  if (pathname.startsWith("/board")) {
    return { mobile: false, desktop: true };
  }

  // Forfeit create flow owns its own back / Next header.
  if (pathname.startsWith("/forfeit")) {
    return { mobile: false, desktop: false };
  }

  return { mobile: true, desktop: true };
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
  return (
    <div
      className="shrink-0 lg:hidden"
      style={{ height: "var(--mobile-bottom-nav-clearance)" }}
      aria-hidden
    />
  );
}

/** Shared mobile navbar + desktop header for main app routes. */
export function MainAppHeader() {
  const pathname = usePathname() ?? "";
  const config = getHeaderConfig(pathname);
  if (!config) return null;

  return (
    <>
      {config.mobile ? (
        <div className="lg:hidden">
          <Navbar />
        </div>
      ) : null}
      {config.desktop ? <MainDesktopHeader /> : null}
    </>
  );
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
  const needsMobileNavOffset = config?.mobile ?? false;
  const nestedScroll = usesNestedScroll(pathname);

  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        nestedScroll ? "flex flex-col overflow-hidden" : "overflow-y-auto scrollbar-hide",
        needsMobileNavOffset && "pt-[4.5rem] lg:pt-0",
      )}
    >
      {children}
    </div>
  );
}
