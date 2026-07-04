"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Video, VideoOff } from "lucide-react";
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
  | "recording"
  | "processing"
  | "uploading"
  | "upload-error";

interface LiveCameraProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (frameUrls: string[]) => void;
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
const MIN_STOP_SECONDS = 10;
const MAX_FRAME_WIDTH = 960;

function frameCountFor(durationSeconds: number) {
  return Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(durationSeconds / 12)));
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
  const [captureStep, setCaptureStep] = useState<CaptureStep>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<Blob[]>([]);
  const stoppingRef = useRef(false);

  const busy = isSubmitting || captureStep === "processing" || captureStep === "uploading";
  const activeStepLabel =
    captureStep === "processing"
      ? "Processing…"
      : captureStep === "uploading"
        ? "Uploading…"
        : STEP_LABEL[proofStep];

  const displayError =
    captureStep !== "upload-error"
      ? (submitError ? getContractErrorDisplay(submitError).message : null)
      : null;

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

  const resetCapture = useCallback(() => {
    clearTimers();
    releaseStream();
    framesRef.current = [];
    stoppingRef.current = false;
    setCaptureStep("idle");
    setRemainingSeconds(durationSeconds);
    setUploadError(null);
  }, [clearTimers, releaseStream, durationSeconds]);

  useEffect(() => {
    if (!open) resetCapture();
  }, [open, resetCapture]);

  // Always release the camera on unmount, regardless of open state.
  useEffect(() => {
    return () => {
      clearTimers();
      releaseStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sampleFrame = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        resolve();
        return;
      }
      const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) framesRef.current.push(blob);
          resolve();
        },
        "image/jpeg",
        0.75,
      );
    });
  }, []);

  const uploadFrames = useCallback(async () => {
    setCaptureStep("uploading");
    setUploadError(null);
    try {
      if (framesRef.current.length === 0) {
        throw new Error("No frames were captured. Try recording again.");
      }
      const uploaded = await Promise.all(
        framesRef.current.map(async (blob, i) => {
          const formData = new FormData();
          formData.append("file", new File([blob], `frame-${i}.jpg`, { type: "image/jpeg" }));
          const res = await fetch("/api/ipfs/upload-image", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Upload failed");
          }
          const { url } = await res.json();
          return { i, url: url as string };
        }),
      );
      uploaded.sort((a, b) => a.i - b.i);
      onSubmit(uploaded.map((f) => f.url));
    } catch (err) {
      setCaptureStep("upload-error");
      setUploadError(err instanceof Error ? err.message : "Failed to upload. Try again.");
    }
  }, [onSubmit]);

  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimers();
    await sampleFrame();
    releaseStream();
    setCaptureStep("processing");
    void uploadFrames();
  }, [clearTimers, sampleFrame, releaseStream, uploadFrames]);

  const startRecording = useCallback(async () => {
    setCaptureStep("requesting-permission");
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      framesRef.current = [];
      stoppingRef.current = false;
      startedAtRef.current = Date.now();
      setRemainingSeconds(durationSeconds);
      setCaptureStep("recording");

      const frameCount = frameCountFor(durationSeconds);
      const frameIntervalMs = (durationSeconds * 1000) / frameCount;
      frameIntervalRef.current = setInterval(() => void sampleFrame(), frameIntervalMs);

      countdownIntervalRef.current = setInterval(() => {
        const elapsedMs = Date.now() - startedAtRef.current;
        const remaining = Math.max(0, durationSeconds - elapsedMs / 1000);
        setRemainingSeconds(Math.ceil(remaining));
        if (remaining <= 0) void stopRecording();
      }, 250);
    } catch {
      setCaptureStep("permission-denied");
    }
  }, [durationSeconds, sampleFrame, stopRecording]);

  const elapsedSeconds = durationSeconds - remainingSeconds;
  const canStopManually = captureStep === "recording" && elapsedSeconds >= MIN_STOP_SECONDS;
  const durationLabel = `${Math.round(durationSeconds / 60)} minute${durationSeconds > 60 ? "s" : ""}`;

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
      hideTitleVisually
      sheetClassName="rounded-t-3xl pb-14"
      modalClassName="max-w-lg"
    >
      <div className="-mt-1 mb-5 flex justify-center lg:hidden">
        <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
      </div>

      {submitSuccess ? (
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
      ) : (
        <div className="space-y-4">
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
              {proofInstructions ?? `Record yourself for up to ${durationLabel} to prove it.`}
            </p>
          </div>

          {displayError && !busy ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/6 px-4 py-3">
              <p className="text-sm font-bold text-destructive">Couldn&apos;t submit</p>
              <p className="mt-0.5 text-xs text-destructive/80">{displayError}</p>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-2xl bg-black">
            <div className="aspect-[4/3]">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className={cn(
                  "h-full w-full object-cover",
                  captureStep === "idle" || captureStep === "permission-denied" ? "hidden" : "",
                )}
              />
              <canvas ref={canvasRef} className="hidden" />

              {captureStep === "idle" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0d0d0d]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <Video className="h-7 w-7 text-white/70" strokeWidth={1.75} />
                  </div>
                  <p className="px-6 text-center text-sm text-white/70">
                    Up to {durationLabel} — start when ready
                  </p>
                </div>
              ) : null}

              {captureStep === "permission-denied" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0d0d0d] px-6 text-center">
                  <VideoOff className="h-8 w-8 text-white/70" strokeWidth={1.75} />
                  <p className="text-sm text-white/70">
                    Camera access was denied. Enable camera permissions for this site and try again.
                  </p>
                </div>
              ) : null}
            </div>

            {captureStep === "recording" ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-4">
                <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  ● Recording
                </span>
                <span className="rounded-full bg-black/60 px-4 py-2 text-2xl font-black tabular-nums text-white backdrop-blur-sm">
                  {remainingSeconds}s
                </span>
              </div>
            ) : null}

            {busy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-[3px]">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-sm font-bold text-white">{activeStepLabel}</p>
                {isSubmitting && proofStep === "wallet-sign" ? (
                  <p className="text-xs text-white/60">Open your wallet app</p>
                ) : null}
              </div>
            ) : null}

            {captureStep === "upload-error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-[3px]">
                <p className="text-sm font-bold text-white">Couldn&apos;t upload your recording</p>
                {uploadError ? <p className="text-xs text-white/70">{uploadError}</p> : null}
                <button
                  type="button"
                  onClick={() => void uploadFrames()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#1a1a19]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry upload
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="h-12 flex-1 rounded-full border border-border bg-background text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              Cancel
            </button>

            {captureStep === "recording" ? (
              <button
                type="button"
                onClick={() => void stopRecording()}
                disabled={!canStopManually}
                className={cn(
                  "flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98]",
                  canStopManually
                    ? "bg-delulu-blue text-white hover:opacity-90"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                Stop early
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={busy || captureStep === "requesting-permission" || captureStep === "upload-error"}
                className={cn(
                  "flex h-12 flex-[2] items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98]",
                  busy || captureStep === "requesting-permission" || captureStep === "upload-error"
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "bg-delulu-blue text-white hover:opacity-90",
                )}
              >
                {captureStep === "requesting-permission" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Requesting camera…
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
      )}
    </ResponsiveSheet>
  );
}
