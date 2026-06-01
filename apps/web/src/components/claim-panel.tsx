"use client";

import { cn } from "@/lib/utils";
import { useClaimPanel } from "@/contexts/right-panel-context";
import { ClaimPanelContent } from "@/components/claim-panel-content";

export function ClaimPanel() {
  const { isOpen, close } = useClaimPanel();

  return (
    <>
      <aside
        aria-hidden={!isOpen}
        className={cn(
          "hidden lg:flex flex-col h-full shrink-0 bg-background border-r border-border overflow-hidden",
          "transition-[width] duration-300 ease-out",
          isOpen ? "w-[400px]" : "w-0 border-r-0"
        )}
      >
        <div className="w-[400px] h-full flex flex-col min-h-0">
          <ClaimPanelContent onClose={close} />
        </div>
      </aside>

      {/* Keep ClaimPanelContent mounted on mobile too so useGoodDollarClaim state matches desktop
          (next claim time, hasClaimed, etc.). Only visibility/interaction toggle with open state. */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-[70] flex justify-start transition-[visibility] duration-0",
          isOpen ? "visible" : "invisible pointer-events-none",
        )}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className={cn("absolute inset-0 bg-black/40 transition-opacity", isOpen ? "opacity-100" : "opacity-0")}
          aria-label="Close claim"
          onClick={close}
        />
        <aside
          className={cn(
            "relative flex h-full w-full max-w-[400px] flex-col bg-background shadow-xl transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <ClaimPanelContent onClose={close} />
        </aside>
      </div>
    </>
  );
}
