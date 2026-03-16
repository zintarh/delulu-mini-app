"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";

function isValidUrl(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fireConfetti() {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = (confettiModule as any).default || confettiModule;
    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.4 },
        colors: ["#FCD34D", "#4B5563", "#A855F7"],
      });
    }
  } catch {
    // Confetti is optional
  }
}

interface ProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: Error | null;
  onDone?: () => void;
}

export function ProofModal({
  open,
  onOpenChange,
  value,
  onChange,
  onSubmit,
  isSubmitting = false,
  submitSuccess = false,
  submitError = null,
  onDone,
}: ProofModalProps) {
  const [touched, setTouched] = useState(false);
  const confettiFired = useRef(false);
  const trimmed = value.trim();
  const valid = isValidUrl(value);
  const showError = touched && trimmed.length > 0 && !valid;
  const canSubmit = valid && !isSubmitting;

  useEffect(() => {
    if (submitSuccess && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
  }, [submitSuccess]);

  useEffect(() => {
    if (!open) confettiFired.current = false;
  }, [open]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit();
  };

  const handleClose = () => {
    onOpenChange(false);
    onDone?.();
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(open) => {
        if (!open) onDone?.();
        onOpenChange(open);
      }}
      title="Submit Evidence"
      sheetClassName="bg-card rounded-t-3xl pb-8 border-t border-border"
      modalClassName="max-w-md"
    >
      <div className="space-y-4 pt-2">
        {submitSuccess ? (
          <>
            <div className="flex justify-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
            </div>
            <p className="text-center text-foreground font-semibold">
              Evidence submitted.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform"
            >
              Done
            </button>
          </>
        ) : (
          <>
            {isSubmitting && (
              <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Submitting…</span>
              </div>
            )}

            {submitError && !isSubmitting && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {getContractErrorDisplay(submitError).message}
              </p>
            )}

            <div className={cn(isSubmitting && "pointer-events-none opacity-60")}>
              <div>
                <input
                  type="url"
                  placeholder="https://..."
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className={cn(
                    "w-full px-3 py-2.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary",
                    showError
                      ? "border-destructive focus:border-destructive"
                      : "border-border focus:border-primary",
                  )}
                  aria-label="Proof link"
                  aria-invalid={showError}
                  aria-describedby={showError ? "proof-link-error" : undefined}
                />
                {showError && (
                  <p
                    id="proof-link-error"
                    className="text-xs text-destructive mt-1.5"
                  >
                    Enter a valid link (e.g. https://...)
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Google Drive works well; any shareable link is fine.
              </p>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-black rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                    "bg-delulu-yellow-reserved text-delulu-charcoal hover:scale-[0.98] transition-transform",
                    !canSubmit && "opacity-60 cursor-not-allowed",
                  )}
                >
                  Submit
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
