"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { MainDesktopHeader } from "@/components/main-desktop-header";
import { cn } from "@/lib/utils";

export type HeaderConfig = {
  mobile: boolean;
  desktop: boolean;
  wideSearch: boolean;
};

function getHeaderConfig(pathname: string): HeaderConfig | null {
  // Delulu detail renders its own mobile + desktop header (back, share, search).
  if (/^\/delulu\/[^/]+$/.test(pathname)) {
    return null;
  }

  // Create flow: custom mobile title bar; desktop still gets search.
  if (pathname.startsWith("/board")) {
    return { mobile: false, desktop: true, wideSearch: false };
  }

  // Forfeit create flow owns its own back / Next header.
  if (pathname.startsWith("/forfeit")) {
    return { mobile: false, desktop: false, wideSearch: false };
  }

  if (pathname.startsWith("/explore") || pathname.startsWith("/goals")) {
    return { mobile: true, desktop: true, wideSearch: true };
  }

  return { mobile: true, desktop: true, wideSearch: false };
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

/** Shared mobile navbar + desktop search bar for main app routes. */
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
      {config.desktop ? (
        <MainDesktopHeader
          searchClassName={
            config.wideSearch ? "min-w-0 w-full flex-1 max-w-none" : undefined
          }
        />
      ) : null}
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

/** Offsets fixed mobile navbar; scroll container for most routes. */
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
        !nestedScroll &&
          "pb-[calc(56px+max(env(safe-area-inset-bottom),8px)+12px)] lg:pb-0",
      )}
    >
      {children}
    </div>
  );
}
