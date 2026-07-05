"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { HomeSearch } from "@/components/home-search";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";

interface NavbarProps {
  onLogoutClick?: () => void;
}

export function Navbar({ onLogoutClick }: NavbarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false);

  const closeSearch = () => setSearchExpanded(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-secondary/95 backdrop-blur-sm">
      <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-3 pb-3 flex items-center gap-3 min-h-[56px]">
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
              <Image
                src="/favicon_io/favicon-32x32.png"
                alt="Delulu"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
              />
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
