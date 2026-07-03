"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, CheckCircle2, Copy, Loader2, X, XIcon } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

async function fireConfetti() {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = ((confettiModule as unknown as { default?: unknown }).default ??
      confettiModule) as unknown;
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
  milestoneName?: string | null;
  milestoneDeadline?: string | null;
  // Achievement card props — all optional, card degrades gracefully
  campaignTitle?: string | null;
  communityName?: string | null;
  myUsername?: string | null;
  myAvatar?: string | null;
  myStreak?: number;
  myPoints?: number;
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
  milestoneIndex,
  milestoneCount,
  shareUrl,
}: ProofModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
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
      setCopied(false);
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

  // Share handlers
  const milestoneLabel =
    milestoneIndex != null
      ? `Milestone ${milestoneIndex + 1}${milestoneCount != null ? ` of ${milestoneCount}` : ""}`
      : (milestoneName ?? "Milestone");

  const onShareX = () => {
    const streakLine = (myStreak ?? 0) > 0 ? `\n🔥 ${myStreak}-day streak going strong` : "";
    const tweet = `just nailed ${milestoneLabel} on "${campaignTitle ?? "a campaign"}" 🎯${streakLine}\nstaying delusional, staying accountable 💪`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl ?? "")}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const onShareWhatsApp = () => {
    const streakLine = (myStreak ?? 0) > 0 ? `\n🔥 ${myStreak}-day streak going strong` : "";
    const msg = `just nailed ${milestoneLabel} on "${campaignTitle ?? "a campaign"}" 🎯${streakLine}\nstaying delusional, staying accountable 💪\n\n${shareUrl ?? ""}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onDone?.();
        onOpenChange(next);
      }}
      title="Submit proof"
      hideTitleVisually
      sheetClassName="rounded-t-3xl pb-14"
      modalClassName="max-w-lg"
    >
      {/* Drag handle pill — visible on mobile sheet only */}
      <div className="-mt-1 mb-5 flex justify-center lg:hidden">
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
      </div>

      {/* ── Success state ────────────────────────────────────────── */}
      {submitSuccess ? (
        <div className="flex flex-col items-center py-2">
          {/* Achievement card */}
          <div className="w-full rounded-3xl border border-border/60 bg-[#f9f8f4] p-5 shadow-sm">
            {/* Wordmark row */}
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[13px] font-black tracking-tight text-[#1a1a19]">
                delulu<span className="text-[#f6c324]">.</span>
              </span>
              <span className="h-2 w-2 rounded-full bg-[#f6c324]" />
            </div>

            {/* Identity: avatar + handle + campaign */}
            <div className="mb-5 flex items-center gap-3">
              {myAvatar ? (
                <img
                  src={myAvatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a19] text-xs font-black text-white">
                  {myUsername ? myUsername[0].toUpperCase() : "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#1a1a19]">
                  {myUsername ? `@${myUsername}` : "You"}
                </p>
                {campaignTitle ? (
                  <p className="truncate text-xs text-muted-foreground">{campaignTitle}</p>
                ) : null}
              </div>
            </div>

            {/* Milestone banner */}
            <div className="mb-4 rounded-2xl bg-[#f6c324] px-4 py-3.5 text-center">
              <p className="text-[13px] font-black text-[#1a1a19]">
                🏆 {milestoneLabel} done!
              </p>
              {communityName ? (
                <p className="mt-0.5 text-[11px] font-semibold text-[#1a1a19]/60">
                  {communityName} · Campaign
                </p>
              ) : null}
              {/* Points earned — loud and unmissable */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-[#1a1a19]">
                  +{BASE_PROOF_POINTS.toLocaleString()}
                </span>
                <span className="rounded-full bg-[#1a1a19] px-2.5 py-0.5 text-[11px] font-black text-[#f6c324]">
                  pts earned
                </span>
              </div>
            </div>

            {/* Progress dots */}
            {milestoneCount != null && milestoneCount > 0 && milestoneIndex != null ? (
              <div className="mb-4 flex items-center justify-center gap-1.5">
                {Array.from({ length: milestoneCount }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      i <= milestoneIndex ? "bg-[#1a1a19]" : "bg-[#dfdfd9]",
                    )}
                  />
                ))}
                <span className="ml-2 text-[11px] font-bold text-muted-foreground">
                  {milestoneIndex + 1} of {milestoneCount}
                </span>
              </div>
            ) : null}

            {/* Stat pills */}
            {((myStreak ?? 0) > 0 || (myPoints ?? 0) > 0) ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(myStreak ?? 0) > 0 ? (
                  <span className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs font-bold text-[#1a1a19]">
                    🔥 {myStreak}-day streak
                  </span>
                ) : null}
                {(myPoints ?? 0) > 0 ? (
                  <span className="rounded-full border border-border/60 bg-white px-3 py-1 text-xs font-bold text-[#1a1a19]">
                    💫 {myPoints} pts
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Share buttons */}
          {shareUrl ? (
            <div className="mt-4 flex w-full gap-2">
              <button
                type="button"
                onClick={onShareX}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
              >
                <XIcon className="h-3.5 w-3.5" />
                Post on X
              </button>
              <button
                type="button"
                onClick={onShareWhatsApp}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>
              <button
                type="button"
                onClick={onCopy}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
              >
                {copied ? (
                  <span className="text-emerald-600 font-black">✓</span>
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleClose}
            className="mt-3 h-12 w-full rounded-full bg-delulu-blue text-sm font-black text-white transition-opacity hover:opacity-90 active:opacity-75"
          >
            Done
          </button>
        </div>
      ) : (
        /* ── Upload state ──────────────────────────────────────── */
        <div className="space-y-4">
          {/* Header */}
          <div>
            {milestoneName ? (
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {milestoneName}
              </p>
            ) : null}
            <h2
              className="text-xl font-black tracking-tight text-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              Submit proof
            </h2>
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
                  className="mt-1.5 text-xs font-semibold text-delulu-blue hover:underline"
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
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

                {busy ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[3px]">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
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
                className="relative flex h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-border bg-white transition-all"
                style={{
                  background: isDragging
                    ? "radial-gradient(ellipse at 50% 50%, rgba(79,70,229,0.08) 0%, transparent 70%), #ffffff"
                    : "#ffffff",
                }}
              >
                {isDragging && (
                  <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500/60" />
                )}

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Camera
                    className={cn(
                      "h-7 w-7 transition-colors",
                      isDragging ? "text-indigo-500" : "text-muted-foreground/60",
                    )}
                    strokeWidth={1.75}
                  />
                </div>

                <div className="text-center">
                  <p className="text-[15px] font-black text-foreground">
                    {isDragging ? "Drop it here" : "Tap to add proof"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    screenshot · photo · selfie — anything real
                  </p>
                </div>

                <p className="absolute bottom-3 text-[10px] font-semibold text-muted-foreground/40">
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
                "flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98]",
                canSubmit
                  ? "bg-delulu-blue text-white hover:opacity-90"
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
    </ResponsiveSheet>
  );
}
