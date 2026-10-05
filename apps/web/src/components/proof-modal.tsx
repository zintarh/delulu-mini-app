"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { formatProofError, formatUploadError } from "@/lib/community/format-proof-error";
import { ProofSuccessCard } from "@/components/proof-success-card";
import { GameButton } from "@/components/ds";

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
  /** May be async — the modal awaits it so failures can leave loading and show errors. */
  onSubmit: (imageUrl: string) => void | Promise<void>;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: Error | null;
  onDone?: () => void;
  proofInstructions?: string | null;
  isOnChain?: boolean;
  proofStep?: ProofStep;
  milestoneName?: string | null;
  milestoneDeadline?: string | null;
  // Achievement card props - all optional, card degrades gracefully
  campaignTitle?: string | null;
  communityName?: string | null;
  myUsername?: string | null;
  myAvatar?: string | null;
  myStreak?: number;
  myPoints?: number;
  pointsAwarded?: number;
  milestoneIndex?: number | null;
  milestoneCount?: number;
  shareUrl?: string | null;
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
  milestoneName,
  milestoneDeadline,
  campaignTitle,
  communityName,
  myUsername,
  myAvatar,
  myStreak,
  myPoints,
  pointsAwarded,
  milestoneIndex,
  milestoneCount,
  shareUrl,
}: ProofModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = imageFile !== null && !isSubmitting && !isUploading;
  const busy = isSubmitting || isUploading;
  const activeStep: ProofStep = isUploading ? "uploading" : proofStep;
  const submitErrorDisplay = submitError && !uploadError ? formatProofError(submitError) : null;
  const displayError = uploadError ?? submitErrorDisplay?.message ?? null;
  const displayErrorTitle = uploadError
    ? "Couldn't upload"
    : (submitErrorDisplay?.title ?? "Couldn't submit");

  // Keep the error banner visible once a failure lands (don't hide behind a stuck busy overlay).
  const showErrorBanner = Boolean(displayError) && (!busy || Boolean(submitError || uploadError));

  useEffect(() => {
    if (!open) {
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
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error || "Upload failed"), { stage: "upload" as const });
      }
      const { url } = await res.json();
      try {
        await onSubmit(url);
      } catch (err) {
        // Always surface a message in-modal (parent may also set submitError).
        setUploadError(formatProofError(err).message);
      }
    } catch (err) {
      setUploadError(formatUploadError(err).message);
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
      title="Upload proof"
      hideTitleVisually
      sheetClassName="rounded-t-3xl pb-14"
      modalClassName="max-w-lg"
    >
      {/* Drag handle pill (mobile sheet) */}
      <div className="-mt-1 mb-5 flex justify-center lg:hidden">
        <div className="h-[5px] w-10 rounded-full bg-[#dadad4]" />
      </div>

      {/* Success state */}
      {submitSuccess ? (
        <ProofSuccessCard
          campaignTitle={campaignTitle}
          communityName={communityName}
          myUsername={myUsername}
          myAvatar={myAvatar}
          myStreak={myStreak}
          myPoints={myPoints}
          pointsAwarded={pointsAwarded}
          milestoneIndex={milestoneIndex}
          milestoneCount={milestoneCount}
          milestoneName={milestoneName}
          shareUrl={shareUrl}
          onDone={handleClose}
        />
      ) : (
        /* Upload state */
        <div className="space-y-4">
          {/* Header */}
          <div>
            {milestoneName || campaignTitle ? (
              <p className="label-mono mb-1 text-muted-foreground">{milestoneName ?? campaignTitle}</p>
            ) : null}
            <h2 className="m-0 text-2xl font-bold tracking-[-0.02em] text-foreground">Show your proof</h2>
            {milestoneDeadline ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Due{" "}
                {new Date(milestoneDeadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            ) : null}
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {proofInstructions
                ? proofInstructions
                : "Show what you did. A screenshot is totally fine."}
            </p>
          </div>

          {/* Error banner - always visible after a failure */}
          {showErrorBanner ? (
            <div
              role="alert"
              className="rounded-[20px] border-2 border-orange/30 bg-orange-soft px-4 py-3"
            >
              <p className="text-sm font-bold text-orange">{displayErrorTitle}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-orange/90">{displayError}</p>
              {imagePreview ? (
                <button
                  type="button"
                  onClick={clearImage}
                  className="mt-1.5 text-xs font-bold text-blue hover:underline"
                >
                  Try a different photo
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
              <div className="relative overflow-hidden rounded-[20px] border-2 border-line bg-white p-2 shadow-edge">
                <div className="aspect-[4/3] overflow-hidden rounded-xl">
                  <img
                    src={imagePreview}
                    alt="Proof preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

                {busy ? (
                  <div className="absolute inset-2 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-black/45">
                    {activeStep === "ai-verifying" ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 h-[3px] animate-scan bg-yellow shadow-[0_0_24px_6px_rgba(246,195,36,0.6)]"
                      />
                    ) : (
                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                    )}
                    <p className="text-sm font-bold text-white">{STEP_LABEL[activeStep]}</p>
                    {activeStep === "wallet-sign" ? (
                      <p className="text-xs text-white/60">Open your wallet app</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Remove photo"
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-opacity hover:opacity-80"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl bg-white/95 py-2 text-xs font-extrabold uppercase tracking-[0.06em] text-ink"
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
                className={cn(
                  "relative flex h-56 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border-2 border-dashed bg-white transition-colors",
                  isDragging ? "border-ink bg-yellow-soft" : "border-[#bdbdb6]",
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-yellow shadow-edge-yellow">
                  <Camera className="h-8 w-8 text-ink" strokeWidth={2} />
                </div>

                <div className="text-center">
                  <p className="text-base font-extrabold text-foreground">
                    {isDragging ? "Drop it here" : "Tap to add a photo"}
                  </p>
                  <p className="label-mono mt-1 text-[10px] text-muted-foreground">AI checks it in seconds</p>
                </div>

                <p className="absolute bottom-3 font-mono text-[10px] text-muted-foreground/60">max 5 MB</p>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <GameButton variant="line" onClick={handleClose} disabled={busy} className="flex-1">
              Cancel
            </GameButton>
            <GameButton onClick={handleSubmit} disabled={!canSubmit} className="flex-[2]">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {STEP_LABEL[activeStep]}
                </>
              ) : (
                "Submit proof"
              )}
            </GameButton>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
