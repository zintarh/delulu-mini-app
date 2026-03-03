"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LeftSidebar } from "@/components/left-sidebar";

interface ChallengesHeaderProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
}

export function ChallengesHeader({
  onProfileClick,
  onCreateClick,
}: ChallengesHeaderProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSearchClick = () => {
    router.push("/search");
  };

  const handleProfileClick = () => {
    onProfileClick?.();
    setIsMenuOpen(false);
  };

  const handleCreateClick = () => {
    onCreateClick?.();
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-200">
        <nav className="max-w-lg md:max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
          {/* Mobile hamburger menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          {/* Empty space in the middle (no tabs) */}
          <div className="flex-1" />

          <button
            onClick={handleSearchClick}
            className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-6 h-6" />
          </button>
        </nav>
      </header>

      {/* Mobile drawer with left sidebar content */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="p-0">
          <div className="h-full">
            <LeftSidebar
              onProfileClick={handleProfileClick}
              onCreateClick={handleCreateClick}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
