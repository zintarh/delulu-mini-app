"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { HomeSearch } from "@/components/home-search";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { AppLogo } from "@/components/app-logo";

interface NavbarProps {
  onLogoutClick?: () => void;
}

export function Navbar({ onLogoutClick }: NavbarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false);

  const closeSearch = () => setSearchExpanded(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-sm shadow-[0_4px_14px_-10px_rgba(26,26,25,0.08)] dark:bg-card/95">
      <nav className="mx-auto flex min-h-[56px] max-w-lg items-center gap-3 px-4 pb-3 pt-3 md:max-w-7xl md:px-6">
        {searchExpanded ? (
          <>
            <button
              type="button"
              onClick={closeSearch}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-background/60 transition-colors"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
            <HomeSearch
              className="flex-1"
              variant="default"
              placeholder="Search Delulus…"
            />
          </>
        ) : (
          <>
            <Link
              href="/"
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded flex items-center shrink-0"
              aria-label="Delulu home"
            >
              <AppLogo size={32} className="h-8 w-8 shrink-0" />
            </Link>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => setSearchExpanded(true)}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>

            <NavbarProfileMenu onLogoutClick={onLogoutClick} size="compact" />
          </>
        )}
      </nav>
    </header>
  );
}
