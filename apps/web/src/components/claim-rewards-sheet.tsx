"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ClaimPanelContent } from "@/components/claim-panel-content";

interface ClaimRewardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Same GoodDollar daily-claim UX as the desktop claim rail (`ClaimPanelContent`).
 * Use this sheet anywhere we need claim UI outside the main layout panel.
 */
export function ClaimRewardsSheet({ open, onOpenChange }: ClaimRewardsSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      sheetClassName="border-t border-border !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      modalClassName="max-w-lg"
    >
      <div className="mx-auto flex h-[min(90vh,720px)] max-h-[90vh] min-h-0 w-full max-w-lg flex-col">
        <ClaimPanelContent onClose={() => onOpenChange(false)} />
      </div>
    </ResponsiveSheet>
  );
}
