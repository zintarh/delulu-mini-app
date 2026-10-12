"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, XIcon } from "lucide-react";
import { Bolt, Coin, Flame, GameButton } from "@/components/ds";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import { resetProofReward } from "@/lib/proof-reward/client";

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
        colors: ["#F6C324", "#2DB36F", "#EC5B8D", "#161615"],
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
  pointsAwarded?: number;
  milestoneIndex?: number | null;
  milestoneCount?: number;
  milestoneName?: string | null;
  shareUrl?: string | null;
  /** Word-only stake: nudge toward staking money for 10× points. */
  showStakeUpsell?: boolean;
  onDone: () => void;
}

export function ProofSuccessCard({
  campaignTitle,
  communityName,
  myUsername,
  myAvatar,
  myStreak,
  myPoints,
  pointsAwarded = BASE_PROOF_POINTS,
  milestoneIndex,
  milestoneCount,
  milestoneName,
  shareUrl,
  showStakeUpsell = false,
  onDone,
}: ProofSuccessCardProps) {
  const [copied, setCopied] = useState(false);
  const confettiFired = useRef(false);

  // Every proof flow (screenshot, live camera, forfeit) lands here on success,
  // so the celebration lives with the card rather than in each modal.
  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;
    void fireConfetti();
  }, []);

  const milestoneLabel =
    milestoneIndex != null
      ? `Day ${milestoneIndex + 1}`
      : (milestoneName ?? "Day");

  const onShareX = () => {
    const streakLine = (myStreak ?? 0) > 0 ? `\n🔥 ${myStreak}-milestone streak going strong` : "";
    const tweet = `just nailed ${milestoneLabel} on "${campaignTitle ?? "a campaign"}" 🎯${streakLine}\nstaying delusional, staying accountable 💪`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl ?? "")}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const onShareWhatsApp = () => {
    const streakLine = (myStreak ?? 0) > 0 ? `\n🔥 ${myStreak}-milestone streak going strong` : "";
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

  const streak = myStreak ?? 0;
  const progress =
    milestoneCount != null && milestoneCount > 0 && milestoneIndex != null
      ? `${milestoneIndex + 1}/${milestoneCount}`
      : null;

  const statBox = (head: string, band: string, value: React.ReactNode, delay: string) => (
    <div
      className="flex-1 animate-bounce-in overflow-hidden rounded-2xl border-2 bg-white"
      style={{ borderColor: band, boxShadow: `0 4px 0 ${band}`, animationDelay: delay }}
    >
      <div className="label-mono py-1 text-center text-[10px] font-semibold text-white" style={{ background: band }}>
        {head}
      </div>
      <div className="flex items-center justify-center gap-1.5 py-3 font-display text-[26px] font-extrabold leading-none">{value}</div>
    </div>
  );

  // Design: docs/redesign/screens/Proof.dc.html (celebration)
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <span className="relative animate-bounce-in">
        <Flame size={104} />
        {streak > 0 ? (
          <span className="absolute inset-x-0 bottom-1.5 animate-bounce-in font-display text-[34px] font-extrabold text-ink [animation-delay:.5s]">
            {streak}
          </span>
        ) : null}
      </span>
      <h2 className="m-0 mt-3 animate-rise text-[30px] font-bold tracking-[-0.025em]">{milestoneLabel} kept!</h2>
      <p className="mt-1.5 animate-rise text-sm text-muted-foreground [animation-delay:.1s]">
        {campaignTitle ?? "Proof checked"}
        {communityName ? ` · ${communityName}` : ""}
      </p>

      <div className="mt-6 flex w-full gap-2.5">
        {statBox("Points", "#161615", <><Bolt size={20} />+{pointsAwarded.toLocaleString()}</>, ".3s")}
        {statBox("Streak", "#C25E12", <><Flame size={20} />{streak}</>, ".4s")}
        {progress
          ? statBox("Progress", "#157041", progress, ".5s")
          : statBox("Total", "#157041", (myPoints ?? 0).toLocaleString(), ".5s")}
      </div>

      {showStakeUpsell ? (
        <div className="mt-4 flex w-full animate-rise items-center gap-3 rounded-2xl border-2 border-yellow-line bg-yellow-soft px-3.5 py-3 text-left [animation-delay:.6s]">
          <Coin size={28} className="shrink-0" />
          <p className="m-0 text-sm font-semibold leading-snug">
            Stake <b>1,000 G$</b> on your goal to earn <b>10× points</b>
          </p>
        </div>
      ) : null}

      {myUsername ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          {myAvatar ? <img src={myAvatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : null}@{myUsername}
        </div>
      ) : null}

      {shareUrl ? (
        <div className="mt-5 flex w-full gap-2">
          <button
            type="button"
            onClick={onShareX}
            className="press-edge flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-line bg-white text-xs font-bold text-ink shadow-edge-sm"
          >
            <XIcon className="h-3.5 w-3.5" />
            Post on X
          </button>
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="press-edge flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-line bg-white text-xs font-bold text-ink shadow-edge-sm"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy link"
            className="press-edge flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-line bg-white text-ink shadow-edge-sm"
          >
            {copied ? <span className="font-black text-green-edge">✓</span> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}

      <GameButton
        full
        className="mt-4"
        onClick={() => {
          // An unclaimed reward stays in the vault (rewards banner picks it
          // up) — just stop this outcome from showing on the next card.
          resetProofReward();
          onDone();
        }}
      >
        Continue
      </GameButton>
    </div>
  );
}
