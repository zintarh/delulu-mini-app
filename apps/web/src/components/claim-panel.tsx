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

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] flex justify-start">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close claim"
            onClick={close}
          />
          <aside className="relative w-full max-w-[400px] h-full bg-background shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <ClaimPanelContent onClose={close} />
          </aside>
        </div>
      )}
    </>
  );
}
