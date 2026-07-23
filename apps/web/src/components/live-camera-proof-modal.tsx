"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, RefreshCw, VideoOff, X } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { getContractErrorDisplay } from "@/lib/contract-error";
import { ProofSuccessCard } from "@/components/proof-success-card";

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

const STEP_LABEL: Record<ProofStep, string> = {
  idle: "Submitting…",
  uploading: "Uploading…",
  "ai-verifying": "AI reviewing proof…",
  "wallet-sign": "Check your wallet…",
  confirming: "Confirming on-chain…",
};

type CaptureStep =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "previewing"
  | "recording"
  | "ready"
  | "processing"
  | "uploading"
  | "submitting"
  | "upload-error";

interface LiveCameraProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (frameUrls: string[]) => void | Promise<void>;
  durationSeconds: number;
  isSubmitting?: boolean;
  submitSuccess?: boolean;
  submitError?: Error | null;
  onDone?: () => void;
  proofInstructions?: string | null;
  isOnChain?: boolean;
  proofStep?: ProofStep;
  milestoneName?: string | null;
  milestoneDeadline?: string | null;
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

const MIN_FRAMES = 4;
const MAX_FRAMES = 8;
const MAX_FRAME_WIDTH = 960;
const FRAME_UPLOAD_TIMEOUT_MS = 30_000;

function frameCountFor(durationSeconds: number) {
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(durationSeconds / 12)));
}

function frameIntervalMsFor(durationSeconds: number, targetFrames: number) {
  // Spread frames across the recording window, but keep them dense enough
  // that a typical session finishes capturing before the timer runs out.
  return Math.min((durationSeconds * 1000) / targetFrames, 2500);
}

export function LiveCameraProofModal({
  open,
  onOpenChange,
  onSubmit,
  durationSeconds,
  isSubmitting = false,
  submitSuccess = false,
  submitError = null,
  onDone,
  proofInstructions,
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
}: LiveCameraProofModalProps) {
  const targetFrames = useMemo(() => frameCountFor(durationSeconds), [durationSeconds]);

  const [captureStep, setCaptureStep] = useState<CaptureStep>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [capturedCount, setCapturedCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const uploadTasksRef = useRef<Promise<{ i: number; url: string }>[]>([]);
  const uploadControllersRef = useRef<AbortController[]>([]);
  const finishingRef = useRef(false);
  const previewRequestIdRef = useRef(0);
  const targetFramesRef = useRef(targetFrames);

  useEffect(() => {
    targetFramesRef.current = targetFrames;
  }, [targetFrames]);

  const busy =
    isSubmitting ||
    captureStep === "processing" ||
    captureStep === "uploading" ||
    captureStep === "submitting";
  const activeStepLabel =
    captureStep === "processing"
      ? "Processing…"
      : captureStep === "uploading"
        ? "Uploading…"
        : STEP_LABEL[proofStep];

  const displayError =
    captureStep === "upload-error"
      ? null
      : submitError && !busy
        ? getContractErrorDisplay(submitError).message
        : null;

  const progressPct = Math.min(100, Math.round((capturedCount / targetFrames) * 100));
  const framesReady = capturedCount >= targetFrames;

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    countdownIntervalRef.current = null;
    frameIntervalRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const abortPendingUploads = useCallback(() => {
    uploadControllersRef.current.forEach((c) => c.abort());
    uploadControllersRef.current = [];
  }, []);

  const resetCapture = useCallback(() => {
    previewRequestIdRef.current += 1;
    clearTimers();
    releaseStream();
    abortPendingUploads();
    framesRef.current = [];
    uploadTasksRef.current = [];
    finishingRef.current = false;
    setCaptureStep("idle");
    setRemainingSeconds(durationSeconds);
    setCapturedCount(0);
    setUploadError(null);
  }, [clearTimers, releaseStream, abortPendingUploads, durationSeconds]);

  useEffect(() => {
    if (!open) resetCapture();
  }, [open, resetCapture]);

  useEffect(() => {
    if (isSubmitting || submitSuccess) return;
    if (!submitError) return;
    if (captureStep !== "submitting" && captureStep !== "uploading") return;
    setCaptureStep("upload-error");
    setUploadError(getContractErrorDisplay(submitError).message);
  }, [isSubmitting, submitSuccess, submitError, captureStep]);

  useEffect(() => {
    return () => {
      clearTimers();
      releaseStream();
      abortPendingUploads();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadOneFrame = useCallback(async (blob: Blob, i: number, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append("file", new File([blob], `frame-${i}.jpg`, { type: "image/jpeg" }));
    const timeout = AbortSignal.timeout(FRAME_UPLOAD_TIMEOUT_MS);
    const combined =
      signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([signal, timeout])
        : timeout;
    const res = await fetch("/api/ipfs/upload-image", {
      method: "POST",
      body: formData,
      signal: combined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    const { url } = await res.json();
    return { i, url: url as string };
  }, []);

  const startFrameUpload = useCallback(
    (blob: Blob, i: number) => {
      const controller = new AbortController();
      uploadControllersRef.current.push(controller);
      const task = uploadOneFrame(blob, i, controller.signal);
      task.catch(() => {});
      return task;
    },
    [uploadOneFrame],
  );

  const sampleFrame = useCallback((): Promise<number> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        resolve(framesRef.current.length);
        return;
      }
      // Don't overshoot the target once we're done capturing.
      if (framesRef.current.length >= targetFramesRef.current) {
        resolve(framesRef.current.length);
        return;
      }
      const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(framesRef.current.length);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob && framesRef.current.length < targetFramesRef.current) {
            const i = framesRef.current.length;
            framesRef.current.push(blob);
            uploadTasksRef.current.push(startFrameUpload(blob, i));
            setCapturedCount(framesRef.current.length);
          }
          resolve(framesRef.current.length);
        },
        "image/jpeg",
        0.75,
      );
    });
  }, [startFrameUpload]);

  const finishCapturing = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearTimers();

    // Fill any remaining frames while the camera is still live.
    while (framesRef.current.length < targetFramesRef.current && streamRef.current) {
      await sampleFrame();
      if (framesRef.current.length < targetFramesRef.current) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    setCapturedCount(framesRef.current.length);
    setCaptureStep("ready");
  }, [clearTimers, sampleFrame]);

  const uploadFrames = useCallback(async () => {
    clearTimers();
    releaseStream();
    setCaptureStep("uploading");
    setUploadError(null);
    try {
      if (uploadTasksRef.current.length < MIN_FRAMES) {
        throw new Error(`Need at least ${MIN_FRAMES} frames. Record again.`);
      }
      const uploaded = await Promise.all(uploadTasksRef.current);
      uploaded.sort((a, b) => a.i - b.i);
      setCaptureStep("submitting");
      await onSubmit(uploaded.map((f) => f.url));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setCaptureStep("upload-error");
        setUploadError("Upload timed out. Check your connection and try again.");
        return;
      }
      setCaptureStep("upload-error");
      setUploadError(err instanceof Error ? err.message : "Failed to upload. Try again.");
    }
  }, [clearTimers, releaseStream, onSubmit]);

  const retryUpload = useCallback(() => {
    abortPendingUploads();
    uploadTasksRef.current = framesRef.current.map((blob, i) => startFrameUpload(blob, i));
    void uploadFrames();
  }, [startFrameUpload, uploadFrames, abortPendingUploads]);

  const startPreview = useCallback(async () => {
    if (streamRef.current) return;
    const requestId = ++previewRequestIdRef.current;
    setCaptureStep("requesting-permission");
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (requestId !== previewRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCaptureStep("previewing");
    } catch {
      if (requestId !== previewRequestIdRef.current) return;
      setCaptureStep("permission-denied");
    }
  }, []);

  useEffect(() => {
    if (open && captureStep === "idle") void startPreview();
  }, [open, captureStep, startPreview]);

  const beginCapture = useCallback(() => {
    if (!streamRef.current || captureStep !== "previewing") return;

    abortPendingUploads();
    framesRef.current = [];
    uploadTasksRef.current = [];
    finishingRef.current = false;
    startedAtRef.current = Date.now();
    setRemainingSeconds(durationSeconds);
    setCapturedCount(0);
    setCaptureStep("recording");

    void sampleFrame().then((count) => {
      if (count >= targetFramesRef.current) void finishCapturing();
    });

    const frameIntervalMs = frameIntervalMsFor(durationSeconds, targetFramesRef.current);
    frameIntervalRef.current = setInterval(() => {
      void sampleFrame().then((count) => {
        if (count >= targetFramesRef.current) void finishCapturing();
      });
    }, frameIntervalMs);

    countdownIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, durationSeconds - elapsedMs / 1000);
      setRemainingSeconds(Math.ceil(remaining));
      if (remaining <= 0) void finishCapturing();
    }, 250);
  }, [captureStep, durationSeconds, sampleFrame, finishCapturing, abortPendingUploads]);

  const durationLabel =
    durationSeconds >= 60
      ? `${Math.round(durationSeconds / 60)} minute${durationSeconds >= 120 ? "s" : ""}`
      : `${durationSeconds} seconds`;

  const handleClose = () => {
    onOpenChange(false);
    onDone?.();
  };

  const showCamera =
    captureStep === "previewing" || captureStep === "recording" || captureStep === "ready";

  if (submitSuccess) {
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
        <div className="-mt-1 mb-5 flex justify-center lg:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
        </div>
        <ProofSuccessCard
          campaignTitle={campaignTitle}
          communityName={communityName}
          myUsername={myUsername}
          myAvatar={myAvatar}
          myStreak={myStreak}
          myPoints={myPoints}
          milestoneIndex={milestoneIndex}
          milestoneCount={milestoneCount}
          milestoneName={milestoneName}
          shareUrl={shareUrl}
          onDone={handleClose}
        />
      </ResponsiveSheet>
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDone?.();
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#0d0d0d] text-white focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogPrimitive.Title asChild>
            <h2 className="sr-only">
              {milestoneName ? `Upload proof — ${milestoneName}` : "Upload proof"}
            </h2>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {proofInstructions ??
              `Record yourself until ${targetFrames} proof frames are captured.`}
          </DialogPrimitive.Description>

          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className={cn("absolute inset-0 h-full w-full object-cover", showCamera ? "" : "hidden")}
          />
          <canvas ref={canvasRef} className="hidden" />

          {captureStep === "idle" || captureStep === "requesting-permission" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
              <p className="text-sm text-white/60">Starting camera…</p>
            </div>
          ) : null}

          {captureStep === "permission-denied" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <VideoOff className="h-8 w-8 text-white/70" strokeWidth={1.75} />
              <p className="text-sm text-white/70">
                Camera access was denied. Enable camera permissions for this site and try again.
              </p>
            </div>
          ) : null}

          <div
            className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/75 via-black/30 to-transparent px-4 pb-10"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {milestoneName ? (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                    {milestoneName}
                  </p>
                ) : null}
                <p className="text-sm font-black text-white">Upload proof</p>
                {milestoneDeadline ? (
                  <p className="text-[11px] text-white/50">
                    Due{" "}
                    {new Date(milestoneDeadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                disabled={busy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/70">
              {proofInstructions ??
                `Keep the camera on your activity until ${targetFrames} frames are captured.`}
            </p>

            {captureStep === "previewing" || captureStep === "recording" || captureStep === "ready" ? (
              <div className="mt-3 rounded-2xl border border-white/15 bg-black/45 px-3.5 py-2.5 backdrop-blur-md">
                <p className="text-[11px] font-bold text-white/90">
                  {targetFrames} frames required
                </p>
                <p className="mt-0.5 text-[11px] text-white/60">
                  Stay in frame while we capture them (~{durationLabel} max). Upload unlocks when
                  all frames are ready.
                </p>
              </div>
            ) : null}

            {displayError && !busy ? (
              <div className="mt-2 rounded-2xl border border-destructive/40 bg-destructive/25 px-3.5 py-2.5 backdrop-blur-md">
                <p className="text-xs font-bold text-white">Couldn&apos;t submit</p>
                <p className="mt-0.5 text-[11px] text-white/80">{displayError}</p>
              </div>
            ) : null}
          </div>

          {busy ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-[3px]">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <p className="text-sm font-bold text-white">{activeStepLabel}</p>
              {isSubmitting && proofStep === "wallet-sign" ? (
                <p className="text-xs text-white/60">Open your wallet app</p>
              ) : null}
            </div>
          ) : null}

          {captureStep === "upload-error" ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center backdrop-blur-[3px]">
              <p className="text-sm font-bold text-white">Couldn&apos;t upload your recording</p>
              {uploadError ? <p className="text-xs text-white/70">{uploadError}</p> : null}
              <button
                type="button"
                onClick={retryUpload}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#1a1a19]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry upload
              </button>
            </div>
          ) : null}

          <div
            className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-12"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            {captureStep === "recording" || captureStep === "ready" ? (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-white">
                  <span>
                    {framesReady
                      ? "All frames ready"
                      : `Capturing ${capturedCount} of ${targetFrames} frames`}
                  </span>
                  {captureStep === "recording" ? (
                    <span className="tabular-nums text-white/70">{remainingSeconds}s left</span>
                  ) : (
                    <span className="text-emerald-300">Ready to upload</span>
                  )}
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-white/15"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={targetFrames}
                  aria-valuenow={capturedCount}
                  aria-label="Frame capture progress"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300 ease-out",
                      framesReady ? "bg-emerald-400" : "bg-delulu-blue",
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="h-12 flex-1 rounded-full border border-white/25 bg-white/10 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-40"
              >
                Cancel
              </button>

              {captureStep === "recording" ? (
                <button
                  type="button"
                  disabled
                  className="flex h-12 flex-[2] cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white/15 text-sm font-black text-white/40"
                >
                  Capturing frames…
                </button>
              ) : captureStep === "ready" ? (
                <button
                  type="button"
                  onClick={() => void uploadFrames()}
                  disabled={busy || !framesReady}
                  className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-delulu-blue text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                >
                  Upload proof
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    captureStep === "permission-denied" ? void startPreview() : beginCapture()
                  }
                  disabled={busy || captureStep !== "previewing"}
                  className={cn(
                    "flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98]",
                    busy || captureStep !== "previewing"
                      ? "cursor-not-allowed bg-white/15 text-white/40"
                      : "bg-delulu-blue text-white hover:opacity-90",
                  )}
                >
                  {captureStep === "idle" || captureStep === "requesting-permission" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting camera…
                    </>
                  ) : captureStep === "permission-denied" ? (
                    "Try again"
                  ) : (
                    "Start recording"
                  )}
                </button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
