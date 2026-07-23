"use client";

import Link from "next/link";
import Image from "next/image";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { MainDesktopHeader } from "@/components/main-desktop-header";

interface DeluluDetailHeaderProps {
  shareSlot?: React.ReactNode;
  title?: string;
}

export function DeluluDetailHeader({
  shareSlot,
}: DeluluDetailHeaderProps) {
  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-4 py-3">
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
