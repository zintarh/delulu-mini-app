"use client";

import { HomeSearch } from "@/components/home-search";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";

interface MainDesktopHeaderProps {
  onLogoutClick?: () => void;
}

/** Search + profile bar shared by main app pages (desktop). */
export function MainDesktopHeader({ onLogoutClick }: MainDesktopHeaderProps) {
  return (
    <div className="hidden lg:block sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center gap-4 px-6 py-4">
        <HomeSearch variant="hero" className="flex-1" />
        <NavbarProfileMenu onLogoutClick={onLogoutClick} />
      </div>
    </div>
  );
}
