"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";

async function fireConfetti() {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = ((confettiModule as unknown as { default?: unknown }).default ?? confettiModule) as unknown;
    if (typeof confetti === "function") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.35 },
        colors: ["#f6c324", "#4f46e5", "#35d07f", "#ffffff"],
      });
    }
  } catch {
    // optional
  }
}

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

const STEP_LABEL: Record<ProofStep, string> = {
  idle: "Submitting…",
  uploading: "Uploading…",
  "ai-verifying": "AI reviewing proof…",
  "wallet-sign": "Check your wallet…",
  confirming: "Confirming on-chain…",
};

interface ProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (imageUrl: string) => void;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: Error | null;
  onDone?: () => void;
  proofInstructions?: string | null;
  isOnChain?: boolean;
  proofStep?: ProofStep;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function ProofModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  submitSuccess = false,
  submitError = null,
  onDone,
  proofInstructions,
  isOnChain = false,
  proofStep = "idle",
}: ProofModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confettiFired = useRef(false);

  const canSubmit = imageFile !== null && !isSubmitting && !isUploading;
  const busy = isSubmitting || isUploading;
  const activeStep: ProofStep = isUploading ? "uploading" : proofStep;
  const displayError =
    uploadError ?? (submitError ? getContractErrorDisplay(submitError).message : null);

  useEffect(() => {
    if (submitSuccess && !confettiFired.current) {
      confettiFired.current = true;
      void fireConfetti();
    }
  }, [submitSuccess]);

  useEffect(() => {
    if (!open) {
      confettiFired.current = false;
      setImageFile(null);
      setImagePreview(null);
      setUploadError(null);
      setIsUploading(false);
      setIsDragging(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const applyFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose an image file (JPG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("Image must be under 5 MB.");
      return;
    }
    setUploadError(null);
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
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
        err instanceof Error ? err.message : "Failed to upload. Try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onDone?.();
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onDone?.();
        onOpenChange(next);
      }}
      title="Submit proof"
      sheetClassName="rounded-t-3xl px-5 pb-10 pt-4"
      modalClassName="max-w-lg p-0 overflow-hidden"
      contentClassName="lg:p-0"
    >
      <div className="lg:px-6 lg:pb-8 lg:pt-3">
        {/* ── Success state ─────────────────────────────────────── */}
        {submitSuccess ? (
          <div className="flex flex-col items-center py-6 text-center sm:py-8">
            {/* Gradient icon */}
            <div
              className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, #4f46e5 0%, #2563eb 60%, #1d4ed8 100%)",
              }}
            >
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={1.75} />
            </div>

            <h3
              className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              Nailed it!
            </h3>
            <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">
              {isOnChain
                ? "Proof recorded on-chain. You're on a roll."
                : "Keep the streak going — see you next time!"}
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="mt-8 h-12 w-full max-w-xs rounded-full bg-[#1a1a19] text-sm font-black text-white transition-opacity hover:opacity-90 active:opacity-75"
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Upload state ──────────────────────────────────────── */
          <div className="space-y-4">
            {/* Header */}
            <div>
              <h2
                className="text-xl font-black tracking-tight text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                Submit proof
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {proofInstructions
                  ? proofInstructions
                  : "Show what you did — a screenshot is totally fine."}
              </p>
            </div>

            {/* Error banner */}
            {displayError && !busy ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/6 px-4 py-3">
                <p className="text-sm font-bold text-destructive">Couldn&apos;t submit</p>
                <p className="mt-0.5 text-xs text-destructive/80">{displayError}</p>
                {imagePreview ? (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="mt-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Try a different photo →
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Upload zone */}
            <div className={cn("relative", busy && "pointer-events-none")}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleImageSelect}
              />

              {imagePreview ? (
                /* Image preview */
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="aspect-[4/3]">
                    <img
                      src={imagePreview}
                      alt="Proof preview"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Dark gradient at bottom */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {busy ? (
                    /* Loading overlay */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[3px]">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                      <p className="text-sm font-bold text-white">{STEP_LABEL[activeStep]}</p>
                      {activeStep === "wallet-sign" ? (
                        <p className="text-xs text-white/60">Open your wallet app</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={clearImage}
                        aria-label="Remove photo"
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:opacity-80"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>

                      {/* Change photo */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full rounded-full bg-white/90 py-2 text-xs font-bold text-[#1a1a19] backdrop-blur-sm transition-opacity hover:bg-white"
                        >
                          Change photo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Drop zone */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className="relative flex h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/8 transition-all"
                  style={{
                    background: isDragging
                      ? [
                          "radial-gradient(ellipse at 50% 50%, rgba(79,70,229,0.35) 0%, transparent 70%)",
                          "#1a1a19",
                        ].join(", ")
                      : [
                          "radial-gradient(ellipse at 50% 45%, rgba(79,70,229,0.18) 0%, transparent 65%)",
                          "#1a1a19",
                        ].join(", "),
                  }}
                >
                  {isDragging && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500/60" />
                  )}

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8">
                    <Camera
                      className={cn(
                        "h-7 w-7 transition-colors",
                        isDragging ? "text-indigo-400" : "text-white/60",
                      )}
                      strokeWidth={1.75}
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-[15px] font-black text-white">
                      {isDragging ? "Drop it here" : "Tap to add proof"}
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">
                      screenshot · photo · selfie — anything real
                    </p>
                  </div>

                  <p className="absolute bottom-3 text-[10px] font-semibold text-white/20">
                    max 5 MB
                  </p>
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="h-12 flex-1 rounded-full border border-border bg-background text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-black transition-all",
                  canSubmit
                    ? "bg-[#1a1a19] text-white hover:opacity-90 active:scale-[0.98]"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {STEP_LABEL[activeStep]}
                  </>
                ) : (
                  "Submit proof"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
