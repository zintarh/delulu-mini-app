"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";

async function fireConfetti() {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = ((confettiModule as unknown as { default?: unknown }).default ?? confettiModule) as unknown;
    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.4 },
        colors: ["#2563eb", "#f7f9a6", "#35d07f"],
      });
    }
  } catch {
    // optional
  }
}

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

const STEP_LABEL: Record<ProofStep, string> = {
  idle: "Submitting…",
  uploading: "Uploading photo…",
  "ai-verifying": "AI reviewing your proof…",
  "wallet-sign": "Approve in your wallet…",
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
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const applyFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file (JPG, PNG, WebP, or GIF).");
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

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onDone?.();
        onOpenChange(next);
      }}
      title="Submit milestone"
      sheetClassName="rounded-t-3xl px-5 pb-12 pt-5"
      modalClassName="max-w-lg p-0 overflow-hidden"
      contentClassName="lg:p-0"
    >
      <div className="lg:px-6 lg:pb-6 lg:pt-2">
        {submitSuccess ? (
          <div className="flex flex-col items-center px-2 py-6 text-center sm:py-8">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-delulu-blue-light">
              <CheckCircle2 className="h-11 w-11 text-delulu-blue" strokeWidth={2} />
            </div>
            <h3 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Milestone complete!
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {isOnChain
                ? "Your proof is recorded on-chain. Verifying shortly."
                : "Keep the streak going — see you next time!"}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-8 h-12 w-full max-w-sm rounded-full bg-delulu-blue text-sm font-black text-white transition-all hover:bg-delulu-blue/90 active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="lg:hidden">
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Submit milestone
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Show your progress with a photo or screenshot.
              </p>
            </div>
            <p className="hidden text-sm leading-relaxed text-muted-foreground lg:block">
              Show your progress with a photo or screenshot. Clear evidence helps supporters trust
              the journey.
            </p>

            {/* Proof instructions */}
            {proofInstructions ? (
              <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What to submit
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                  {proofInstructions}
                </p>
              </div>
            ) : null}

            {displayError && !busy ? (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3"
              >
                <p className="text-sm font-bold text-destructive">Couldn&apos;t submit</p>
                <p className="mt-0.5 text-sm text-destructive/85">{displayError}</p>
                {imagePreview ? (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="mt-1.5 text-xs font-semibold text-delulu-blue hover:underline"
                  >
                    Try a different photo →
                  </button>
                ) : null}
                {proofInstructions ? (
                  <p className="mt-1 text-xs text-destructive/70">
                    Make sure your image clearly shows: {proofInstructions}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className={cn("relative", busy && "pointer-events-none")}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleImageSelect}
              />

              {imagePreview ? (
                <div className="group relative overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
                  <div className="aspect-[4/3] w-full sm:aspect-[16/10]">
                    <img
                      src={imagePreview}
                      alt="Evidence preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {busy ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-[2px]">
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                      <p className="text-sm font-semibold text-white">
                        {STEP_LABEL[activeStep]}
                      </p>
                      {activeStep === "wallet-sign" ? (
                        <p className="text-xs text-white/70">Check your wallet app</p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                        aria-label="Remove photo"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 rounded-full bg-white/95 py-2.5 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-white"
                        >
                          Change photo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all sm:py-12",
                    "bg-secondary/40 hover:bg-secondary/70",
                    isDragging
                      ? "border-delulu-blue bg-delulu-blue-light/50 ring-2 ring-delulu-blue/20"
                      : "border-border hover:border-delulu-blue/40",
                  )}
                >
                  <div
                    className={cn(
                      "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                      isDragging
                        ? "bg-delulu-blue text-white"
                        : "bg-background text-foreground shadow-sm",
                    )}
                  >
                    {isDragging ? (
                      <ImagePlus className="h-7 w-7" strokeWidth={2} />
                    ) : (
                      <Upload className="h-7 w-7" strokeWidth={2} />
                    )}
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {isDragging ? "Drop your image here" : "Add proof photo"}
                  </p>
                  <p className="mt-1.5 max-w-[240px] text-sm text-muted-foreground">
                    Tap to browse or drag and drop
                  </p>
                  <p className="mt-3 rounded-full bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    JPG · PNG · WebP · GIF · max 5 MB
                  </p>
                </button>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-2xl bg-secondary/50 px-4 py-3.5 text-xs text-muted-foreground sm:text-sm">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-delulu-blue" />
              <span>Use a clear shot of the result — screenshots and timestamps are totally fine.</span>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="h-12 flex-1 rounded-full border border-border bg-background text-sm font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-black transition-all",
                  "bg-delulu-blue text-white hover:bg-delulu-blue/90 active:scale-[0.98]",
                  !canSubmit && "cursor-not-allowed opacity-45",
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
