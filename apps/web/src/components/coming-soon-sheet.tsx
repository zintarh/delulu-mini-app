"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface ComingSoonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComingSoonSheet({ open, onOpenChange }: ComingSoonSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Coming Soon</SheetTitle>
        <div className="max-w-lg mx-auto pt-8 pb-8 px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Coming Soon</h2>
            <p className="text-sm text-white/60">
              This feature is under development and will be available soon.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

