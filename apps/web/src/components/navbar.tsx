"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

interface NavbarProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
  onSearchClick?: () => void;
  activeTab?: "board" | "fyp";
  onTabChange?: (tab: "board" | "fyp") => void;
}

export function Navbar({
  activeTab = "board",
  onTabChange,
  onSearchClick,
}: NavbarProps) {
  const router = useRouter();

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      router.push("/search");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-secondary/95 backdrop-blur-sm border-b border-border">
      <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
        <a
          href="https://stay.delulu.xyz"
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring rounded flex items-center shrink-0"
          aria-label="Delulu home"
        >
          <Image
            src="/favicon_io/favicon-32x32.png"
            alt="Delulu"
            width={32}
            height={32}
            className="h-8 w-8"
          />
        </a>

        <div className="flex items-center gap-1">
            <button
              onClick={() => onTabChange?.("board")}
              className={cn(
                "px- py-2 text-sm font-bold transition-colors relative",
                activeTab === "board"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Board
              {activeTab === "board" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-foreground rounded-full" />
              )}
            </button>
            <button
              onClick={() => onTabChange?.("fyp")}
              className={cn(
                "px-2 py-2 text-sm font-medium transition-colors relative",
                activeTab === "fyp"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              For you
              {activeTab === "fyp" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-foreground rounded-full" />
              )}
            </button>
          </div>

        <button
          onClick={handleSearchClick}
          className="flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-6 h-6" />
        </button>
      </nav>
    </header>
  );
}
