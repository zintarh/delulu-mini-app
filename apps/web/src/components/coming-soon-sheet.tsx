"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

interface ComingSoonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComingSoonSheet({ open, onOpenChange }: ComingSoonSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Coming Soon"
      sheetClassName="border-t border-border !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 pb-8 px-6 lg:pt-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-3">Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              This feature is under development and will be available soon.
            </p>
          </div>
      </div>
    </ResponsiveSheet>
  );
}

