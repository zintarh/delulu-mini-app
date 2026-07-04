"use client";

import { useState } from "react";
import { Copy, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

export async function fireConfetti() {
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

export interface ProofSuccessCardProps {
  campaignTitle?: string | null;
  communityName?: string | null;
  myUsername?: string | null;
  myAvatar?: string | null;
  myStreak?: number;
  myPoints?: number;
  milestoneIndex?: number | null;
  milestoneCount?: number;
  milestoneName?: string | null;
  shareUrl?: string | null;
  onDone: () => void;
}

export function ProofSuccessCard({
  campaignTitle,
  communityName,
  myUsername,
  myAvatar,
  myStreak,
  myPoints,
  milestoneIndex,
  milestoneCount,
  milestoneName,
  shareUrl,
  onDone,
}: ProofSuccessCardProps) {
  const [copied, setCopied] = useState(false);

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
        onClick={onDone}
        className="mt-3 h-12 w-full rounded-full bg-delulu-blue text-sm font-black text-white transition-opacity hover:opacity-90 active:opacity-75"
      >
        Done
      </button>
    </div>
  );
}
