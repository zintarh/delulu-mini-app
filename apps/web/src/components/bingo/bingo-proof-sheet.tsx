"use client";

import { BoostCard } from "@/components/bingo/boost-card";
import { MissionSticker } from "@/components/bingo/mission-stickers";
import { fmtUntil } from "@/lib/bingo/format";

import { useEffect, useRef, useState } from "react";
import { Camera, Clock, ImageIcon, Loader2, Star } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { GameButton } from "@/components/ds";
import { ProofRewardRow } from "@/components/proof-reward-row";
import { NextStepCard } from "@/components/next-step-card";
import type { NextStep, NextStepAction } from "@/lib/next-step";
import { useJoinCommunityCampaignOnChain, useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { useResolveForfeitCommitmentSuccess, useSubmitForfeitProof, useTakeOverForfeitVerifier } from "@/hooks/use-create-forfeit-commitment";
import { useAuth } from "@/hooks/use-auth";
import { startProofReward } from "@/lib/proof-reward/client";
import type { BingoSquareView, BingoView } from "@/lib/bingo/view";
import { cn } from "@/lib/utils";

type Step = "pick" | "uploading" | "checking" | "signing" | "confirming" | "done";

const STEP_LABEL: Partial<Record<Step, string>> = {
  uploading: "Uploading…",
  checking: "Checking your photo…",
  signing: "Confirm in your wallet…",
  confirming: "Filling your square…",
};

/** One square, one photo: pick → upload → review → sign today's proof → filled. */
export function BingoProofSheet({
  attemptId,
  square,
  open,
  onOpenChange,
  onFilled,
  nextStep,
  onNextAction,
  reward,
  closesAt,
  bingo,
  onBoosted,
}: {
  attemptId: string;
  square: BingoSquareView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilled: (index: number) => void | Promise<void>;
  /** What to do next once the square is filled (from the refreshed card). */
  nextStep?: NextStep | null;
  onNextAction?: (action: NextStepAction) => void;
  /** G$ this photo earns (face-verified players). */
  reward?: number;
  /** When today's square closes, for the countdown. */
  closesAt?: string | null;
  /** The card, so claim-and-top-up can sit on the photo itself. */
  bingo?: BingoView | null;
  onBoosted?: () => void | Promise<void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const { submitCommunityCampaignMilestoneProofAndWait } = useSubmitCommunityMilestoneProofOnChain();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const { submitProofAndWait } = useSubmitForfeitProof();
  const { resolveCommitmentSuccessAndWait } = useResolveForfeitCommitmentSuccess();
  const { takeOverAndWait } = useTakeOverForfeitVerifier();
  const { address: wallet } = useAuth();

  // A square stuck at "confirming" reopens with its approved photo, ready to sign.
  const resumeUrl = square?.state === "confirming" ? square.photoUrl : null;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError(null);
    setStep("pick");
    setPreview(resumeUrl);
  }, [open, square?.index, resumeUrl]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError({ title: "That's not a photo", body: "Pick a photo for this square." });
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!square) return;
    setError(null);
    try {
      let url = resumeUrl;
      if (file) {
        setStep("uploading");
        const form = new FormData();
        form.append("file", file);
        const up = await fetch("/api/ipfs/upload-image", { method: "POST", body: form });
        const upJson = await up.json().catch(() => ({}));
        if (!up.ok || !upJson.url) throw Object.assign(new Error(upJson.error ?? "Upload failed. Try again."), { title: "Couldn't upload" });
        url = upJson.url as string;
      }
      if (!url) return;

      setStep("checking");
      const res = await fetch(`/api/bingo/attempts/${attemptId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squareIndex: square.index, proofUrls: [url], tzOffsetMinutes: -new Date().getTimezoneOffset() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(json.reason ?? json.error ?? "Your photo wasn't accepted."), {
          title: res.status === 422 ? "Try another photo" : "Not filled yet",
        });
      }

      if (json.filled) {
        // Already done (recovered from an earlier attempt) — nothing to sign.
      } else if (json.requiresOnChain && json.kind === "forfeit") {
        // The player signs the day. Cards that still name Delulu's server as verifier
        // are moved to the player's own wallet first — the server no longer marks the day done.
        setStep("signing");
        if (json.serverVerified) {
          if (!wallet) throw Object.assign(new Error("Connect your wallet to sign this day."), { title: "Wallet needed" });
          await takeOverAndWait(json.onChainCommitmentId, wallet as `0x${string}`);
        }
        const proofTx = await submitProofAndWait(json.onChainCommitmentId, json.proofUrl);
        const resolveTx = await resolveCommitmentSuccessAndWait(json.onChainCommitmentId);
        setStep("confirming");
        await fetch("/api/forfeit/confirm-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proofTxHash: proofTx, resolveTxHash: resolveTx, walletAddress: wallet }),
        }).catch(() => null);
        startProofReward({ kind: "forfeit", proofTxHash: proofTx });
        const conf = await fetch(`/api/bingo/attempts/${attemptId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ squareIndex: square.index, txHash: proofTx, resolveTxHash: resolveTx }),
        });
        if (!conf.ok) {
          const cj = await conf.json().catch(() => ({}));
          throw Object.assign(new Error(cj.error ?? "Your proof is saved — reopen the square to finish."), { title: "Almost there" });
        }
      } else if (json.requiresOnChain) {
        setStep("signing");
        if (json.needsJoin && json.bonusCampaignId && wallet) {
          // First bonus photo: join that square's free campaign (no stake), quietly.
          const j = await fetch(`/api/community/campaigns/${json.bonusCampaignId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: wallet }),
          });
          const jj = await j.json().catch(() => ({}));
          if (!j.ok) throw new Error(jj.error ?? "Couldn't open this bonus square.");
          const joinTx = await joinCommunityCampaignAndWait(jj.challengeId);
          await fetch(`/api/community/campaigns/${json.bonusCampaignId}/confirm-join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash: joinTx, walletAddress: wallet }),
          }).catch(() => null);
        }
        const tx = await submitCommunityCampaignMilestoneProofAndWait(json.challengeId, json.milestoneId, json.proofUrl);
        setStep("confirming");
        // Bonus squares earn on-chain points; the per-photo G$ reward is for the daily squares.
        if (!json.bonusCampaignId) startProofReward({ kind: "campaign", proofTxHash: tx });
        const conf = await fetch(`/api/bingo/attempts/${attemptId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ squareIndex: square.index, txHash: tx }),
        });
        if (!conf.ok) {
          const cj = await conf.json().catch(() => ({}));
          throw Object.assign(new Error(cj.error ?? "Your proof is saved — reopen the square to finish."), { title: "Almost there" });
        }
      }
      setStep("done");
      await onFilled(square.index);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const cancelled = /user (rejected|denied)|rejected the request|cancel/i.test(raw);
      setError({
        title: cancelled ? "Not signed" : ((e as { title?: string }).title ?? "Something went wrong"),
        body: cancelled ? "Your photo was approved. Tap Fill square to sign when you're ready." : raw,
      });
      setStep("pick");
    }
  };

  const busy = step !== "pick" && step !== "done";
  const canSubmit = !busy && (file != null || resumeUrl != null);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={square?.title ?? "Bingo square"}
      sheetClassName="rounded-t-3xl pb-10"
      modalClassName="max-w-md"
    >
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />

      <div className="flex flex-col gap-4 px-5 pt-1">
        {square?.bonus ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-yellow px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
            <Star className="h-3 w-3" fill="currentColor" /> Bonus square · any day · earns points
          </span>
        ) : null}

        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 pb-2 text-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="aspect-square w-40 animate-[bingo-fill_.7s_cubic-bezier(.34,1.56,.64,1)_both] rounded-2xl object-cover" />
            ) : null}
            <p className="font-display text-2xl font-extrabold uppercase">Square filled</p>
            {square && !square.bonus ? <ProofRewardRow /> : null}
            {square?.bonus ? <p className="m-0 text-[13px] font-bold text-green-edge">+ bonus points</p> : null}
            {nextStep ? (
              <NextStepCard
                step={nextStep}
                className="w-full"
                onAction={(action) => {
                  onOpenChange(false);
                  onNextAction?.(action);
                }}
              />
            ) : null}
            <GameButton variant={nextStep?.cta ? "line" : "ink"} full onClick={() => onOpenChange(false)}>
              Back to my card
            </GameButton>
          </div>
        ) : (
          <>
            {bingo && square && !square.bonus ? <BoostCard bingo={bingo} onBoosted={() => onBoosted?.()} /> : null}
            {square && !square.bonus ? (
              <div className="flex items-center gap-3">
                <MissionSticker title={square.title} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="label-mono m-0 text-[10px] text-muted-foreground">Day {square.index + 1}</p>
                  <p className="m-0 text-[17px] font-extrabold leading-tight">{square.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {reward ? <span className="rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-extrabold text-green-edge">+{reward.toLocaleString("en-US")} G$</span> : null}
                    {closesAt && Date.parse(closesAt) > Date.now() ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-extrabold text-orange">
                        <Clock className="h-3 w-3" /> closes in {fmtUntil(closesAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => !busy && !resumeUrl && cameraRef.current?.click()}
              className={cn(
                "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2",
                preview ? "border-ink bg-ink" : "border-dashed border-yellow-line bg-yellow-soft",
              )}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className={cn("h-full w-full object-cover", busy && "opacity-60")} />
              ) : (
                <span className="flex flex-col items-center gap-2 text-ink">
                  <Camera className="h-8 w-8" />
                  <span className="text-sm font-bold">Take a photo</span>
                </span>
              )}
              {busy ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-sm font-bold">{STEP_LABEL[step]}</span>
                  {step === "signing" ? <span className="max-w-[16rem] text-center text-xs font-semibold">Approve each request. You sign this day.</span> : null}
                </span>
              ) : null}
            </button>

            {!resumeUrl ? (
              <div className="grid grid-cols-2 gap-2">
                <GameButton variant="line" size="sm" onClick={() => cameraRef.current?.click()} disabled={busy}>
                  <Camera className="h-4 w-4" /> Camera
                </GameButton>
                <GameButton variant="line" size="sm" onClick={() => galleryRef.current?.click()} disabled={busy}>
                  <ImageIcon className="h-4 w-4" /> Gallery
                </GameButton>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl bg-orange-soft px-3 py-2.5 text-orange">
                <p className="text-[13px] font-extrabold">{error.title}</p>
                <p className="text-[13px] font-semibold leading-snug">{error.body}</p>
              </div>
            ) : (
              <p className="text-center text-[12px] font-semibold text-muted-foreground">A photo you took today works best.</p>
            )}

            <GameButton variant="yellow" full onClick={() => void submit()} disabled={!canSubmit}>
              {busy ? STEP_LABEL[step] : "Fill square"}
            </GameButton>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
