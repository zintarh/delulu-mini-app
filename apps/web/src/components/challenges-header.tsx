"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";

interface ChallengesHeaderProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
  onSearchClick?: () => void;
}

export function ChallengesHeader({ onSearchClick }: ChallengesHeaderProps) {
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
        <Link
          href="/campaigns"
          className="flex items-center justify-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Back to campaigns"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <span className="text-sm font-semibold text-foreground">
          Campaigns
        </span>

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
