"use client";

import { ArrowLeft } from "lucide-react";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { MainDesktopHeader } from "@/components/main-desktop-header";

interface DeluluDetailHeaderProps {
  onBack: () => void;
  shareSlot: React.ReactNode;
  title?: string;
}

export function DeluluDetailHeader({
  onBack,
  shareSlot,
  title,
}: DeluluDetailHeaderProps) {
  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-0.5">
            {shareSlot}
            <NavbarProfileMenu size="compact" />
          </div>
        </div>
      </div>

      <MainDesktopHeader />
    </>
  );
}
