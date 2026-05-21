"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, Loader2, ImageIcon, X } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";

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
  onSubmit: (imageUrl: string) => void;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: Error | null;
  onDone?: () => void;
}

export function ProofModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  submitSuccess = false,
  submitError = null,
  onDone,
}: ProofModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confettiFired = useRef(false);

  const canSubmit = imageFile !== null && !isSubmitting && !isUploading;

  useEffect(() => {
    if (submitSuccess && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
  }, [submitSuccess]);

  useEffect(() => {
    if (!open) {
      confettiFired.current = false;
      setImageFile(null);
      setImagePreview(null);
      setUploadError(null);
      setIsUploading(false);
    }
  }, [open]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.");
      return;
    }
    setUploadError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!canSubmit || !imageFile) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await fetch("/api/ipfs/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await res.json();
      onSubmit(url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload image. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onDone?.();
  };

  const busy = isSubmitting || isUploading;
  const displayError = uploadError ?? (submitError ? getContractErrorDisplay(submitError).message : null);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(open) => {
        if (!open) onDone?.();
        onOpenChange(open);
      }}
      title="Submit Proof"
      sheetClassName="rounded-t-3xl pb-8 border-t border-border"
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
              Proof submitted successfully.
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
            <p className="text-xs text-muted-foreground">
              Upload a photo or screenshot that clearly shows you completed this milestone.
            </p>

            {busy && (
              <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">
                  {isUploading ? "Uploading…" : "Verifying proof…"}
                </span>
              </div>
            )}

            {displayError && !busy && (
              <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5">
                <p className="text-xs font-semibold text-destructive mb-0.5">Proof not accepted</p>
                <p className="text-xs text-destructive/80">{displayError}</p>
              </div>
            )}

            <div className={cn(busy && "pointer-events-none opacity-60")}>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Proof preview"
                    className="w-full max-h-52 object-cover rounded-md border border-border"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                >
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs font-medium">Tap to select an image</span>
                  <span className="text-[10px] text-muted-foreground/60">JPG, PNG, GIF, WebP — max 5 MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

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
