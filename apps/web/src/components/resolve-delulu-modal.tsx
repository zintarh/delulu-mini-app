"use client";

import { useState, useEffect } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";
import { useResolveDelulu } from "@/hooks/use-resolve-delulu";
import type { FormattedDelulu } from "@/lib/types";

interface ResolveDeluluModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delulu: FormattedDelulu | null;
  onSuccess?: () => void;
}

export function ResolveDeluluModal({
  open,
  onOpenChange,
  delulu,
  onSuccess,
}: ResolveDeluluModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null);
  const { resolve, isPending, isConfirming, isSuccess, error } = useResolveDelulu();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedOutcome(null);
    }
  }, [open]);

  // Handle success
  useEffect(() => {
    if (isSuccess && delulu) {
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    }
  }, [isSuccess, delulu, onOpenChange, onSuccess]);

  const handleResolve = async () => {
    if (!delulu || selectedOutcome === null) return;

    try {
      // Use the array index (id) instead of onChainId
      await resolve(delulu.id, selectedOutcome, delulu.creator);
    } catch (error) {
      console.error("[ResolveDeluluModal] Error resolving:", error);
      // Error is handled by the hook and displayed below
    }
  };

  const isLoading = isPending || isConfirming;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      showClose={!isLoading}
      title=""
      sheetClassName="border-t-2 border-delulu-charcoal !p-0 !z-[100] rounded-t-3xl bg-white"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 pb-6 px-6 lg:pt-6">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-delulu-charcoal tracking-tight">
              Resolve Market
            </h2>
            <p className="text-sm text-delulu-charcoal/70 font-medium">
              Select the outcome for this market
            </p>
          </div>

          {delulu && (
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <p className="text-sm font-medium text-delulu-charcoal mb-2">
                Market #{delulu.id}
              </p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {delulu.content || "No content available"}
              </p>
            </div>
          )}

          {/* Outcome Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-delulu-charcoal/80 uppercase tracking-wider">
              Outcome
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedOutcome(true)}
                disabled={isLoading}
                className={cn(
                  "p-4 rounded-lg border-2 font-bold text-sm transition-all",
                  selectedOutcome === true
                    ? "bg-green-100 border-green-600 text-green-800 shadow-[3px_3px_0px_0px_#16a34a]"
                    : "bg-white border-gray-300 text-gray-700 hover:border-green-400 shadow-[2px_2px_0px_0px_#d1d5db]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  <span>True</span>
                </div>
                <p className="text-xs font-normal mt-1 text-gray-600">
                  Believers Win
                </p>
              </button>
              <button
                onClick={() => setSelectedOutcome(false)}
                disabled={isLoading}
                className={cn(
                  "p-4 rounded-lg border-2 font-bold text-sm transition-all",
                  selectedOutcome === false
                    ? "bg-red-100 border-red-600 text-red-800 shadow-[3px_3px_0px_0px_#dc2626]"
                    : "bg-white border-gray-300 text-gray-700 hover:border-red-400 shadow-[2px_2px_0px_0px_#d1d5db]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <X className="w-5 h-5" />
                  <span>False</span>
                </div>
                <p className="text-xs font-normal mt-1 text-gray-600">
                  Did Not Come True
                </p>
              </button>
            </div>
          </div>

          {/* Success Message */}
          {isSuccess && (
            <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
              <p className="text-sm font-medium text-green-800 text-center">
                ✓ Market resolved successfully!
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg">
              <p className="text-sm font-medium text-red-800 text-center">
                {error.message || "Failed to resolve market"}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm",
                "bg-white text-delulu-charcoal",
                "border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                "hover:bg-gray-50 hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
                "active:scale-[0.98] active:shadow-[1px_1px_0px_0px_#1A1A1A]",
                "transition-all duration-100",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={selectedOutcome === null || isLoading || isSuccess}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm",
                "bg-delulu-yellow-reserved text-delulu-charcoal",
                "border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                "hover:bg-delulu-yellow-reserved/90 hover:shadow-[4px_4px_0px_0px_#1A1A1A]",
                "active:scale-[0.98] active:shadow-[2px_2px_0px_0px_#1A1A1A]",
                "transition-all duration-100",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
                "flex items-center justify-center gap-2"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving...
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Resolved
                </>
              ) : (
                "Resolve"
              )}
            </button>
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
