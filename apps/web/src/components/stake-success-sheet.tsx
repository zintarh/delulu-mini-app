"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle } from "lucide-react";

interface StakeSuccessSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBeliever: boolean;
  amount: number;
}

export function StakeSuccessSheet({
  open,
  onOpenChange,
  isBeliever,
  amount,
}: StakeSuccessSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[80] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Stake Success</SheetTitle>

        <div className="max-w-lg mx-auto pt-12 pb-8 px-6">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-delulu-green/10 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-delulu-green" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white/90 text-center mb-2">
            Success!
          </h2>

          {/* Message */}
          <p className="text-sm text-white/60 text-center mb-6">
            You&apos;ve successfully placed a stake of{" "}
            <span className="font-bold text-white/90">{amount.toFixed(2)} cUSD</span> as a{" "}
            {isBeliever ? "believer" : "doubter"}.
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

