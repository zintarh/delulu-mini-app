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

  if (pathname.startsWith("/explore")) {
    return { mobile: true, desktop: true, wideSearch: true };
  }

  return { mobile: true, desktop: true, wideSearch: false };
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

/** Offsets fixed mobile navbar; keeps desktop pages flush with sticky search bar. */
export function MainAppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const config = getHeaderConfig(pathname);
  const needsMobileNavOffset = config?.mobile ?? false;

  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-hidden",
        needsMobileNavOffset && "pt-[4.5rem] lg:pt-0",
      )}
    >
      {children}
    </div>
  );
}
