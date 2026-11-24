"use client";

import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import { gameButtonClass } from "@/components/ds";
import { ReferralInviteCard } from "@/components/referral-invite-card";
import { useAuth } from "@/hooks/use-auth";
import { referralRewardNow, isReferralCampaignLive, referralRoundForCopy, roundHasStreakBonus } from "@/lib/referral/campaign";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });

/**
 * Shown wherever a stake is bigger than the wallet (Bingo, campaigns, a new
 * delulu): never just "not enough" — always the ways to get there. Free
 * daily money first, then inviting friends while referrals pay out (the
 * invite card handles the link, and what's left to unlock it).
 */
export function LowBalancePanel({
  need,
  have,
  className,
}: {
  need: number;
  have: number;
  className?: string;
}) {
  const { address } = useAuth();
  const short = Math.max(0, need - have);
  const referrals = isReferralCampaignLive();
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <p className="m-0 text-center text-[13px] font-bold">
        You need {fmt(short)} more G$ <span className="font-semibold text-muted-foreground">· you have {fmt(have)}</span>
      </p>
      <Link href="/daily-claim" className={gameButtonClass({ variant: "yellow", full: true })}>
        <Gift className="h-4 w-4" /> Claim free G$ today <ArrowRight className="h-4 w-4" />
      </Link>
      {referrals && address ? (
        <>
          <p className="label-mono m-0 mt-1 text-center text-[10px] text-muted-foreground">
            Or invite friends · {fmt(referralRewardNow())} G$ each ·{" "}
            {roundHasStreakBonus(referralRoundForCopy()) ? "paid as they verify, earn points and show up 3 days" : "paid once they verify and earn points"}
          </p>
          <ReferralInviteCard address={address} />
        </>
      ) : null}
    </div>
  );
}
