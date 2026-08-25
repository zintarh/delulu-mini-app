"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Clock, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded, isCampaignExpired, getEffectiveDisplayEndsAt } from "@/lib/community/campaign-types";
import { AvatarStack, type AvatarStackParticipant } from "@/components/ui/avatar-stack";

export type ActiveMilestoneData = {
  milestone_id: number;
  label: string;
  deadline: string | null;
  start_time?: string | null;
  is_overdue?: boolean;
};

export type CampaignExploreCardData = {
  id: string;
  title: string;
  description?: string | null;
  proposedPoolAmount: number;
  durationDays: number;
  coverImageUrl: string | null;
  displayEndsAt: string | null;
  createdAt?: string | null;
  status: string;
  participantCount: number;
  participantAvatars?: AvatarStackParticipant[];
  milestoneCount: number;
  canJoin?: boolean;
  isOnChain?: boolean;
  isJoined: boolean;
  isFreeToJoin?: boolean;
  joinToken?: string;
  joinAmount?: number;
  forfeitPct?: number;
  proofInstructions?: string | null;
  proofCadence?: string;
  prizeWinnerCount?: number;
  telegramLink?: string | null;
  community: { name: string; slug: string } | null;
  activeMilestone?: ActiveMilestoneData | null;
};

function daysLeft(effectiveEndsAt: string | null) {
  if (!effectiveEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(effectiveEndsAt).getTime() - Date.now()) / 86400000));
}

export function CampaignExploreCard({
  campaign,
  className,
  compact = false,
}: {
  campaign: CampaignExploreCardData;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  joining?: boolean;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  onJoin?: () => void;
  onSubmitMilestone?: () => void;
  proofBusy?: boolean;
  className?: string;
  /** Shorter home-rail cards so three fit in the viewport. */
  compact?: boolean;
}) {
  const href = `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
  const funded = isCampaignFunded(campaign.status);
  const effectiveEndsAt = getEffectiveDisplayEndsAt({
    display_ends_at: campaign.displayEndsAt,
    created_at: campaign.createdAt,
    duration_days: campaign.durationDays,
  });
  const isClosed = isCampaignExpired({
    display_ends_at: campaign.displayEndsAt,
    created_at: campaign.createdAt,
    duration_days: campaign.durationDays,
  });
  const poolAmount = campaign.proposedPoolAmount;
  const left = daysLeft(effectiveEndsAt);
  const stakeLabel =
    campaign.isFreeToJoin === false && (campaign.joinAmount ?? 0) > 0
      ? `Join · Stake ${campaign.joinAmount} ${campaign.joinToken ?? "G$"}`
      : "Join free";

  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl bg-delulu-blue-light/40 dark:bg-accent shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
        compact
          ? "aspect-[4/3] h-full min-h-0 rounded-xl lg:aspect-auto"
          : "aspect-[1/1] sm:aspect-[4/5]",
        className,
      )}
    >
      {campaign.coverImageUrl ? (
        <Image
          src={campaign.coverImageUrl}
          alt=""
          fill
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-105",
            isClosed && "grayscale",
          )}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]">
          <Target className={cn("text-white/20", compact ? "h-7 w-7" : "h-10 w-10")} />
        </div>
      )}

      {/* Bottom scrim so the overlaid text stays legible without hiding the image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/5" />

      {/* Joined badge, top-left */}
      {campaign.isJoined ? (
        <div className={cn("absolute", compact ? "left-2 top-2" : "left-3 top-3")}>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-delulu-charcoal">
            <Check className="h-3 w-3" />
            Joined
          </span>
        </div>
      ) : null}

      {/* Prize badge — only when funded (status active). Amount is proposed target;
          live claimable may differ until detail loads on-chain pool. */}
      {funded && poolAmount > 0 ? (
        <div className={cn("absolute", compact ? "right-2 top-2" : "right-3 top-3")}>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#D1E822] px-2.5 py-1 text-[11px] font-black text-[#244E1A]">
            <Trophy className="h-3 w-3" />
            {poolAmount} G$ prize
          </span>
        </div>
      ) : null}

      {/* Overlaid content — title + the two things worth knowing before you tap in:
          how much longer it's open, and what joining costs. Everything else
          (description, join button, milestones) lives on the detail page. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0",
          compact ? "px-3 pb-3.5 pt-2.5 lg:p-3" : "p-4 sm:p-5",
        )}
      >
        <h3
          className={cn(
            "text-white",
            compact
              ? "line-clamp-1 text-sm font-bold leading-snug tracking-tight"
              : "line-clamp-2 text-lg font-bold leading-snug tracking-tight",
          )}
        >
          {campaign.title}
        </h3>

        <div
          className={cn(
            "flex items-center justify-between gap-2",
            compact ? "mt-2.5 lg:mt-1.5" : "mt-3 sm:mt-2",
          )}
        >
          <div className="flex items-center gap-3 text-xs font-semibold text-white/85">
            <span
              className={cn(
                "flex items-center gap-1",
                !isClosed && left != null && left <= 3 && "text-amber-300",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {isClosed
                ? "Ended"
                : left == null
                  ? `${campaign.durationDays}d`
                  : left === 0
                    ? "Ends today"
                    : `${left}d left`}
            </span>
            {campaign.participantCount > 0 ? (
              <span className="flex items-center gap-1.5">
                {campaign.participantAvatars && campaign.participantAvatars.length > 0 ? (
                  <AvatarStack
                    participants={campaign.participantAvatars}
                    total={campaign.participantCount}
                    size={compact ? 16 : 18}
                  />
                ) : (
                  <>
                    <Users className="h-3.5 w-3.5" />
                    {campaign.participantCount}
                  </>
                )}
              </span>
            ) : null}
          </div>
          {!isClosed ? (
            <span
              className={cn(
                "shrink-0 rounded-full bg-black font-bold text-white",
                compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
              )}
            >
              {stakeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function CampaignExploreCardSkeleton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative animate-pulse overflow-hidden rounded-2xl bg-muted",
        compact
          ? "aspect-[4/3] h-full min-h-0 rounded-xl lg:aspect-auto"
          : "aspect-[1/1] sm:aspect-[4/5]",
        className,
      )}
    >
      <div className="absolute right-3 top-3 h-6 w-16 rounded-full bg-background/60" />
      <div className={cn("absolute inset-x-0 bottom-0", compact ? "px-3 pb-3.5 pt-2.5 lg:p-3" : "p-4 sm:p-5")}>
        <div className="h-5 w-3/4 rounded-lg bg-background/60" />
        <div className="mt-2.5 h-4 w-1/2 rounded-lg bg-background/60" />
      </div>
    </div>
  );
}
