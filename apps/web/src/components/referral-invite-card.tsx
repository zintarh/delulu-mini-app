"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Circle, CheckCircle2, Lock, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReferralEligibility } from "@/hooks/use-referral-eligibility";
import { ONBOARDING_STEP_LABELS } from "@/components/referral-onboarding-checklist";
import { GameButton, GameCard, GameLink, Trophy } from "@/components/ds";
import {
  REFERRAL_GDOLLARS_REWARD,
  isReferralCampaignLive,
  referralCampaignEndLabel,
} from "@/lib/referral/campaign";

/** The wallet's referral code (lazily created server-side) and how many referrals have counted. */
function useReferralCode(address: string | null) {
  const [state, setState] = useState<{ code: string | null; count: number; isLoading: boolean }>({
    code: null,
    count: 0,
    isLoading: Boolean(address),
  });

  useEffect(() => {
    if (!address) {
      setState({ code: null, count: 0, isLoading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true }));
    void (async () => {
      try {
        const res = await fetch(`/api/profile/${address}`);
        const json = (await res.json()) as {
          profile?: { referral_code?: string | null };
          referralCount?: number;
        };
        if (!cancelled) {
          setState({ code: json.profile?.referral_code ?? null, count: json.referralCount ?? 0, isLoading: false });
        }
      } catch {
        if (!cancelled) setState({ code: null, count: 0, isLoading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return state;
}

/**
 * Rewards-page home for referrals. While a campaign is live: the invite link
 * (gated on onboarding + good standing, same rules the server enforces).
 * Between campaigns: just a way back to past referrals, if there are any.
 */
export function ReferralInviteCard({ address }: { address: string }) {
  const live = isReferralCampaignLive();
  const { code, count, isLoading: isLoadingCode } = useReferralCode(address);
  // Eligibility hits the subgraph — skip it entirely while referrals are off.
  const { isLoading: isLoadingEligibility, eligible, steps, standing } = useReferralEligibility(
    live ? address : null,
  );
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  if (!live) {
    if (isLoadingCode || count === 0) return null;
    return (
      <Link
        href="/referrals"
        className="flex animate-rise items-center gap-3 rounded-[20px] border-2 border-line bg-white px-3.5 py-3 shadow-edge"
      >
        <Trophy size={36} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">My referrals</div>
          <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">{count} counted</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    );
  }

  if (isLoadingCode || isLoadingEligibility) {
    return <div className="h-[72px] animate-pulse rounded-[20px] bg-line" aria-busy="true" />;
  }
  if (!code) return null;

  const locked = eligible && Boolean(standing?.locked);
  const unlockHref = standing?.campaign
    ? `/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`
    : "/";

  const handleInvite = async () => {
    const url = `${window.location.origin}/sign-in?ref=${code}`;
    // Native share sheet on phones; clipboard everywhere else (or if dismissed oddly).
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Delulu", text: "Join me on Delulu", url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  };

  const sub = locked
    ? "Post today's proof to unlock"
    : eligible
      ? `${REFERRAL_GDOLLARS_REWARD.toLocaleString()} G$ each · ends ${referralCampaignEndLabel()}`
      : "Finish onboarding first";

  return (
    <GameCard className="animate-rise px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <Trophy size={40} />
          {locked || !eligible ? (
            <span className="absolute -bottom-1 -right-1 flex h-[20px] w-[20px] items-center justify-center rounded-full border-2 border-white bg-ink text-white">
              <Lock className="h-2.5 w-2.5" strokeWidth={2.6} />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">Invite friends</span>
            {count > 0 ? (
              <Link
                href="/referrals"
                className="rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-extrabold text-green-edge"
              >
                {count} ✓
              </Link>
            ) : null}
          </div>
          <div className="label-mono mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</div>
        </div>
        {locked ? (
          <GameLink href={unlockHref} variant="ink" size="sm">
            Post
          </GameLink>
        ) : eligible ? (
          <GameButton variant="yellow" size="sm" onClick={() => void handleInvite()}>
            {copied ? <Check className="h-4 w-4" strokeWidth={2.4} /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
            {copied ? "Copied" : "Invite"}
          </GameButton>
        ) : (
          <GameButton variant="line" size="sm" onClick={() => setShowSteps((o) => !o)} aria-expanded={showSteps}>
            Steps
            <ChevronDown className={cn("h-4 w-4 transition-transform", showSteps && "rotate-180")} />
          </GameButton>
        )}
      </div>

      {!eligible && showSteps ? (
        <ul className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
          {ONBOARDING_STEP_LABELS.map(({ key, label }) => {
            const done = Boolean(steps?.[key]);
            return (
              <li
                key={key}
                className={cn("flex items-center gap-2 text-xs font-semibold", done ? "text-green-edge" : "text-muted-foreground")}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" strokeWidth={2} />
                )}
                <span className={done ? "line-through decoration-1" : undefined}>{label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </GameCard>
  );
}
