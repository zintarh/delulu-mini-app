"use client";

import { HomeSearch } from "@/components/home-search";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";

interface MainDesktopHeaderProps {
  onLogoutClick?: () => void;
  /** When false, only the profile menu is shown (pinned to the right). */
  showSearch?: boolean;
  searchClassName?: string;
}

/** Search + profile bar shared by main app pages (desktop). */
export function MainDesktopHeader({
  onLogoutClick,
  showSearch = true,
  searchClassName = "min-w-0 flex-1 max-w-2xl",
}: MainDesktopHeaderProps) {
  return (
    <div className="hidden lg:block sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="flex w-full items-center gap-4 px-6 py-4 lg:px-8">
        {showSearch ? (
          <HomeSearch variant="hero" className={searchClassName} />
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}
        <div className="ml-auto shrink-0">
          <NavbarProfileMenu onLogoutClick={onLogoutClick} />
        </div>
      </div>
    </div>
  );
}
