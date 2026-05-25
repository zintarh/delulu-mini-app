"use client";

import { cn } from "@/lib/utils";
import { createFlowPx } from "@/components/create-flow-layout";
import { MOBILE_BOTTOM_NAV_CLEARANCE } from "@/lib/mobile-bottom-nav";

interface CreateFlowMobileFooterProps {
  children: React.ReactNode;
  className?: string;
}

/** Sticky action area above the bottom nav on mobile create steps. */
export function CreateFlowMobileFooter({
  children,
  className,
}: CreateFlowMobileFooterProps) {
  return (
    <div
      className={cn(
        "lg:hidden shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-md",
        createFlowPx,
        "py-3",
        className,
      )}
      style={{ paddingBottom: MOBILE_BOTTOM_NAV_CLEARANCE }}
    >
      {children}
    </div>
  );
}
