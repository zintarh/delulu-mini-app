"use client";

import { NavbarProfileMenu } from "@/components/navbar-profile-menu";

interface MainDesktopHeaderProps {
  onLogoutClick?: () => void;
}

/** Profile bar shared by main app pages (desktop). */
export function MainDesktopHeader({ onLogoutClick }: MainDesktopHeaderProps) {
  return (
    <div className="sticky top-0 z-30 hidden bg-white shadow-[0_4px_14px_-10px_rgba(26,26,25,0.08)] dark:bg-card lg:block">
      <div className="flex w-full items-center gap-4 px-6 py-4 lg:px-8">
        <div className="min-w-0 flex-1" aria-hidden />
        <div className="ml-auto shrink-0">
          <NavbarProfileMenu onLogoutClick={onLogoutClick} />
        </div>
      </div>
    </div>
  );
}
