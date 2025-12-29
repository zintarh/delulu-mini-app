"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SelfGate } from "@/components/self-gate";

interface VerificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countryCode: string;
  onVerified: () => void;
}

export function VerificationSheet({
  open,
  onOpenChange,
  countryCode,
  onVerified,
}: VerificationSheetProps) {
  const [key, setKey] = useState(0);

  // Reset the SelfGate component when sheet closes
  useEffect(() => {
    if (!open) {
      // Increment key to force remount of SelfGate when sheet reopens
      setKey((prev) => prev + 1);
    }
  }, [open]);

  const handleVerified = () => {
    // Call the parent callback first to update verified state
    onVerified();
    // Close sheet after a brief delay to show success state in SelfGate
    setTimeout(() => {
      onOpenChange(false);
    }, 5000); // Give 2 seconds to see the success message
  };

  // Conditional rendering: Only render if countryCode is strictly defined and not empty
  if (!countryCode || typeof countryCode !== "string" || countryCode.trim() === "") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="bg-gray-900 border-t border-gray-800 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
        >
          <SheetTitle className="sr-only">Verify Your Identity</SheetTitle>
          <div className="max-w-lg mx-auto pt-6 pb-8 px-6">
            <div className="text-center py-8">
              <p className="text-sm text-white/60">Loading gate info...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-gray-900 border-t border-gray-800 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Verify Your Identity</SheetTitle>
        <div className="max-w-lg mx-auto pt-6 pb-8 px-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              Verify Your Identity
            </h2>
            <p className="text-sm text-white/60">
              Please verify your nationality to stake on this delulu
            </p>
          </div>
          <SelfGate 
            key={key} 
            countryCode={countryCode} 
            onVerified={handleVerified} 
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

