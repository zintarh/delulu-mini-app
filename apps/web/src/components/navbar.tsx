"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, Menu } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LeftSidebar } from "@/components/left-sidebar";

interface NavbarProps {
  onProfileClick?: () => void;
  onCreateClick?: () => void;
  activeTab?: "vision" | "fyp";
  onTabChange?: (tab: "vision" | "fyp") => void;
}

export function Navbar({
  onProfileClick,
  onCreateClick,
  activeTab = "fyp",
  onTabChange,
}: NavbarProps) {
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
          {/* Mobile hamburger menu (replaces connect button area) */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onTabChange?.("vision")}
              className={cn(
                "px- py-2 text-sm font-bold transition-colors relative",
                activeTab === "vision"
                  ? "text-delulu-charcoal"
                  : "text-gray-400 hover:text-delulu-charcoal"
              )}
            >
              Vision
              {activeTab === "vision" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
              )}
            </button>
            <button
              onClick={() => onTabChange?.("fyp")}
              className={cn(
                "px-2 py-2 text-sm font-medium transition-colors relative",
                activeTab === "fyp"
                  ? "text-delulu-charcoal"
                  : "text-gray-400 hover:text-delulu-charcoal"
              )}
            >
              For you
              {activeTab === "fyp" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-delulu-charcoal rounded-full" />
              )}
            </button>
          </div>

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
