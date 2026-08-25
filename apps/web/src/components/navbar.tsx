"use client";

import Link from "next/link";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { AppLogo } from "@/components/app-logo";

interface NavbarProps {
  onLogoutClick?: () => void;
}

export function Navbar({ onLogoutClick }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-sm shadow-[0_4px_14px_-10px_rgba(26,26,25,0.08)] dark:bg-card/95">
      <nav className="mx-auto flex min-h-[56px] max-w-lg items-center gap-3 px-4 pb-3 pt-3 md:max-w-7xl md:px-6">
        <Link
          href="/"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded flex items-center shrink-0"
          aria-label="Delulu home"
        >
          <AppLogo size={32} className="h-8 w-8 shrink-0" />
        </Link>

        <div className="flex-1" />

        <NavbarProfileMenu onLogoutClick={onLogoutClick} size="compact" />
      </nav>
    </header>
  );
}
