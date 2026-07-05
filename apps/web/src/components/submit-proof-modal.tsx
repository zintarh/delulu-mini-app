"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ProofModal } from "@/components/proof-modal";
import { LiveCameraProofModal } from "@/components/live-camera-proof-modal";
import { useIsMobileDevice } from "@/lib/device";

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

interface SubmitProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (proofUrls: string[]) => void;
  proofType?: string | null;
  liveCameraDurationSeconds?: number | null;
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

/**
 * Single entry point for "submit proof" anywhere in the app. Decides between
 * the screenshot flow, the live-camera flow, and a phone-required blocked
 * state, based on the campaign's proof_type — so every call site (campaign
 * detail page, home feed, etc.) behaves identically instead of each one
 * re-implementing this branch.
 */
export function SubmitProofModal({
  open,
  onOpenChange,
  onSubmit,
  proofType,
  liveCameraDurationSeconds,
  onDone,
  ...rest
}: SubmitProofModalProps) {
  const isMobileDevice = useIsMobileDevice();

  if (proofType === "live_camera") {
    if (isMobileDevice) {
      return (
        <LiveCameraProofModal
          open={open}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          durationSeconds={liveCameraDurationSeconds ?? 60}
          onDone={onDone}
          {...rest}
        />
      );
    }

    return (
      <ResponsiveSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onDone?.();
          onOpenChange(next);
        }}
        title="Use your phone"
        sheetClassName="rounded-t-3xl pb-14"
        modalClassName="max-w-sm"
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            This campaign requires a live camera recording. Open this page on your phone to submit proof.
          </p>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onDone?.();
            }}
            className="mt-2 h-11 w-full rounded-full border border-border bg-background text-sm font-bold text-foreground transition-colors hover:bg-muted"
          >
            Got it
          </button>
        </div>
      </ResponsiveSheet>
    );
  }

  return (
    <ProofModal
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={(url) => onSubmit([url])}
      onDone={onDone}
      {...rest}
    />
  );
}
