"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ChevronLeft, Image as ImageIcon, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProofError, formatUploadError } from "@/lib/community/format-proof-error";
import { ProofSuccessCard } from "@/components/proof-success-card";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";

const DARK_ICON_BUTTON =
  "press-edge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink-3 bg-ink-2 text-white shadow-[0_3px_0_#000]";

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
  showStakeUpsell?: boolean;
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
  isOnChain: _isOnChain = false,
  proofStep = "idle",
  milestoneName,
  milestoneDeadline: _milestoneDeadline,
  campaignTitle,
  communityName,
  myUsername,
  myAvatar,
  myStreak,
  myPoints,
  pointsAwarded,
  showStakeUpsell,
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
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
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

  if (!open) return null;

  const title = milestoneName ?? campaignTitle ?? null;
  const dayLabel = milestoneIndex != null ? `Day ${milestoneIndex + 1}` : null;
  const headerLabel = [title, dayLabel].filter(Boolean).join(" · ");
  const capturing = !submitSuccess && !imagePreview;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Upload proof">
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleImageSelect} />
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden lg:h-[844px] lg:max-h-[92vh] lg:max-w-[420px] lg:rounded-[32px]",
          capturing ? "bg-[#0F0F0E] text-white" : "bg-paper text-ink",
        )}
      >
        {submitSuccess ? (
          <div className="flex-1 overflow-y-auto px-5 pb-8 pt-6 scrollbar-hide">
            <ProofSuccessCard
              campaignTitle={campaignTitle}
              communityName={communityName}
              myUsername={myUsername}
              myAvatar={myAvatar}
              myStreak={myStreak}
              myPoints={myPoints}
              pointsAwarded={pointsAwarded}
              showStakeUpsell={showStakeUpsell}
              milestoneIndex={milestoneIndex}
              milestoneCount={milestoneCount}
              milestoneName={milestoneName}
              shareUrl={shareUrl}
              onDone={handleClose}
            />
          </div>
        ) : capturing ? (
          /* Capture (design: Proof.dc.html, dark camera screen) */
          <>
            <div className="flex items-center justify-between px-5 py-4">
              <button type="button" onClick={handleClose} aria-label="Close" className={DARK_ICON_BUTTON}>
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
              <span className="label-mono truncate px-3 text-[#A3A39C]">{headerLabel}</span>
              <span className="w-11 shrink-0" />
            </div>
            <div className="px-5">
              <h2 className="m-0 animate-rise text-2xl font-bold leading-[1.2] tracking-[-0.02em] text-white">
                Show us your <span className="text-yellow">proof</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative mx-5 mt-[18px] flex flex-1 items-center justify-center rounded-[28px] bg-ink-2 px-10 text-center",
                isDragging && "ring-2 ring-yellow",
              )}
            >
              {(["left-[18px] top-[18px] border-l-[3px] border-t-[3px] rounded-tl-[10px]", "right-[18px] top-[18px] border-r-[3px] border-t-[3px] rounded-tr-[10px]", "bottom-[18px] left-[18px] border-b-[3px] border-l-[3px] rounded-bl-[10px]", "bottom-[18px] right-[18px] border-b-[3px] border-r-[3px] rounded-br-[10px]"] as const).map((pos) => (
                <span key={pos} aria-hidden className={cn("absolute h-[30px] w-[30px] border-yellow", pos)} />
              ))}
              <span className="text-sm leading-relaxed text-[#A3A39C]">
                {proofInstructions || "Show what you did. A screenshot is totally fine."}
              </span>
            </button>
            {showErrorBanner ? (
              <p role="alert" className="mx-5 mt-3 rounded-2xl bg-orange px-4 py-2.5 text-sm font-semibold text-white">
                {displayError}
              </p>
            ) : null}
            <div className="flex items-center justify-between px-5 pb-9 pt-[22px]">
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload from gallery" className={DARK_ICON_BUTTON}>
                <ImageIcon className="h-5 w-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                aria-label="Take photo"
                className="h-[84px] w-[84px] rounded-full border-4 border-white p-1.5"
              >
                <span className="block h-full w-full rounded-[22px] bg-yellow" />
              </button>
              <span className="w-11" />
            </div>
          </>
        ) : (
          /* Review (design: Proof.dc.html, "AI check") */
          <div className="flex flex-1 flex-col gap-[18px] px-5 pb-9 pt-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={clearImage} disabled={busy} aria-label="Back to camera" className={ICON_BUTTON_CLASS}>
                <ChevronLeft className="h-5 w-5" strokeWidth={2} />
              </button>
              <span className="label-mono text-muted-foreground">AI check</span>
              <span className="w-11" />
            </div>
            <div className="relative flex-1 -rotate-2 animate-rise bg-white p-3 pb-14 shadow-[0_24px_40px_-26px_rgba(22,22,21,.5)]">
              <div className="relative h-full overflow-hidden bg-[#E2E2DC]">
                {imagePreview ? <img src={imagePreview} alt="Your proof" className="h-full w-full object-cover" /> : null}
                {busy ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 h-[3px] animate-scan bg-yellow shadow-[0_0_24px_6px_rgba(246,195,36,0.6)]"
                  />
                ) : null}
              </div>
              <span className="label-mono absolute bottom-5 left-4 right-4 truncate text-ink">
                {busy ? STEP_LABEL[activeStep] : title ? `Checking: ${title}` : "Ready for the AI check"}
              </span>
            </div>
            {showErrorBanner ? (
              <div role="alert" className="rounded-[20px] border-2 border-orange/30 bg-orange-soft px-4 py-3">
                <p className="text-sm font-bold text-orange">{displayErrorTitle}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-orange/90">{displayError}</p>
              </div>
            ) : null}
            {activeStep === "wallet-sign" && busy ? (
              <p className="-mt-2 text-center text-xs text-muted-foreground">Open your wallet app</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={clearImage}
                disabled={busy}
                className="press-edge h-14 rounded-2xl border-2 border-line bg-white font-bold shadow-edge disabled:opacity-50"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="press-edge flex h-14 items-center justify-between rounded-2xl bg-ink pl-5 pr-1.5 font-bold text-white shadow-edge-ink disabled:opacity-60"
              >
                {busy ? "Checking…" : "Submit"}
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow text-ink">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" strokeWidth={2.4} />}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
