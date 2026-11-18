"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Lock } from "lucide-react";
import { useReferralCode } from "@/components/referral-invite-card";
import { useReferralEligibility } from "@/hooks/use-referral-eligibility";
import { referralCampaignEndLabel, referralOpensLabel, referralPhase } from "@/lib/referral/campaign";
import { cn } from "@/lib/utils";

/**
 * One slim row for referrals (Home, Profile): what you earn, your link one tap
 * from the clipboard, and › to see who you've invited and who counts.
 */
export function ReferralBanner({ address, className }: { address: string; className?: string }) {
  const phase = referralPhase();
  const live = phase.phase === "live";
  const { code, count } = useReferralCode(address);
  const { eligible, standing, isLoading } = useReferralEligibility(phase.phase === "off" ? null : address);
  const [copied, setCopied] = useState(false);
  if (phase.phase === "off") return null;

  const reward = phase.round.reward.toLocaleString("en-US");
  const locked = eligible && Boolean(standing?.locked);
  const canCopy = live && eligible && !locked && !!code;
  const sub = !live
    ? `Opens ${referralOpensLabel(phase.round)}`
    : isLoading
      ? "Checking your link…"
      : locked
        ? "Post today's proof to unlock your link"
        : !eligible
          ? "Finish setting up to unlock your link"
          : `${count > 0 ? `${count} counted · ` : ""}round ends ${referralCampaignEndLabel()}`;

  const copy = async () => {
    if (!code) return;
    const url = `${window.location.origin}/sign-in?ref=${code}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Delulu", text: `Join me on Delulu — you get 1,000 G$ free to start 🎁`, url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border-2 border-line bg-white py-2.5 pl-3 pr-2 shadow-edge-sm", className)}>
      <span className="text-[22px] leading-none" aria-hidden>
        🤝
      </span>
      <Link href="/referrals" className="min-w-0 flex-1 text-ink no-underline">
        <p className="m-0 truncate text-[14px] font-extrabold leading-tight">Invite friends · {reward} G$ each</p>
        <p className="m-0 truncate text-[11px] font-semibold text-muted-foreground">{sub}</p>
      </Link>
      {canCopy ? (
        <button
          type="button"
          onClick={() => void copy()}
          className="press-edge inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-yellow px-3 text-[12px] font-extrabold uppercase text-ink shadow-edge-yellow"
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      ) : !live || locked || !eligible ? (
        <Lock className="h-4 w-4 shrink-0 text-faint" />
      ) : null}
      <Link href="/referrals" aria-label="See who you invited" className="flex h-9 w-7 shrink-0 items-center justify-center text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
