"use client";

import { useEffect } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

interface StakePositionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBeliever: boolean;
}

export function StakePositionSheet({
  open,
  onOpenChange,
  isBeliever,
}: StakePositionSheetProps) {
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default || confettiModule;
        if (typeof confetti === "function") {
          confetti({
            particleCount: 140,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#22c55e", "#0ea5e9", "#f97316", "#a855f7"],
          });
        }
      } catch {
        // Confetti is optional
      }
    })();
  }, [open]);

  const sideLabel = "Believer";

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title=""
      sheetClassName="border-t border-border !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[80] rounded-t-3xl bg-card"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-10 pb-8 px-6 lg:pt-6 text-center text-foreground">
        <p className="text-xs tracking-[0.35em] uppercase text-muted-foreground mb-3">
          Staked as
        </p>
        <p className="text-2xl font-black text-foreground mb-3">
          {sideLabel}
        </p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8">
          You&apos;ve already staked on this delulu. You can only stake once and
          stay on the same side of the market.
        </p>

        <button
          onClick={() => onOpenChange(false)}
          className="w-full py-3 font-bold text-sm rounded-md border border-border bg-secondary text-foreground hover:bg-muted active:scale-[0.98] transition-all duration-100"
        >
          Got it
        </button>
      </div>
    </ResponsiveSheet>
  );
}

