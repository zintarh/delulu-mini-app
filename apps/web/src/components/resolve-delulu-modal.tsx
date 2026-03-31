"use client";

import { useEffect } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
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
  const { resolve, isPending, isConfirming, isSuccess, error } =
    useResolveDelulu();

  useEffect(() => {
    if (isSuccess && delulu) {
      const t = setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, delulu, onOpenChange, onSuccess]);

  const handleResolve = async () => {
    if (!delulu) return;
    try {
      await resolve(delulu.id);
    } catch (e) {
      console.error("[ResolveDeluluModal] Error resolving:", e);
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
              Resolve goal
            </h2>
            <p className="text-sm text-delulu-charcoal/70 font-medium">
              Marks this delulu as resolved on-chain after the resolution
              deadline. Creator or owner only.
            </p>
          </div>

          {delulu && (
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <p className="text-sm font-medium text-delulu-charcoal mb-2">
                Delulu #{delulu.id}
              </p>
              <p className="text-xs text-gray-600 line-clamp-2">
                {delulu.content || "No content available"}
              </p>
            </div>
          )}

          {isSuccess && (
            <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
              <p className="text-sm font-medium text-green-800 text-center">
                ✓ Submitted successfully
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg">
              <p className="text-sm font-medium text-red-800 text-center">
                {error.message || "Failed to resolve"}
              </p>
            </div>
          )}

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
              disabled={isLoading || isSuccess}
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
                  Sending…
                </>
              ) : isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Done
                </>
              ) : (
                "Resolve on-chain"
              )}
            </button>
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
