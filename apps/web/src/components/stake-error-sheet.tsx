"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { XCircle } from "lucide-react";

interface StakeErrorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorMessage: string;
}

export function StakeErrorSheet({
  open,
  onOpenChange,
  errorMessage,
}: StakeErrorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[80] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Stake Error</SheetTitle>

        <div className="max-w-lg mx-auto pt-12 pb-8 px-6">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white/90 text-center mb-2">
            Error
          </h2>

          {/* Error Message */}
          <p className="text-sm text-white/60 text-center mb-6 break-words">
            {errorMessage}
          </p>

          {/* Divider */}
          <div className="w-full border-t border-white/10 mb-6" />

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-3 font-bold text-sm btn-game bg-white text-delulu-dark"
          >
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

