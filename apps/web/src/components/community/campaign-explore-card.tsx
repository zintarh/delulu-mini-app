"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Clock, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded, isCampaignEndedByDate } from "@/lib/community/campaign-types";
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

function daysLeft(displayEndsAt: string | null, durationDays: number) {
  if (!displayEndsAt) return durationDays;
  return Math.max(0, Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000));
}

export function CampaignExploreCard({
  campaign,
  className,
}: {
  campaign: CampaignExploreCardData;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  joining?: boolean;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  onJoin?: () => void;
  onSubmitMilestone?: () => void;
  proofBusy?: boolean;
  className?: string;
}) {
  const href = `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
  const funded = isCampaignFunded(campaign.status);
  const isClosed = isCampaignEndedByDate(campaign.displayEndsAt);
  const poolAmount = campaign.proposedPoolAmount;
  const left = daysLeft(campaign.displayEndsAt, campaign.durationDays);
  const stakeLabel =
    campaign.isFreeToJoin === false && (campaign.joinAmount ?? 0) > 0
      ? `Join · Stake ${campaign.joinAmount} ${campaign.joinToken ?? "G$"}`
      : "Join free";

  return (
    <Link
      href={href}
      className={cn(
        "group relative block aspect-[1/1] overflow-hidden rounded-2xl bg-delulu-blue-light/40 shadow-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:aspect-[4/5]",
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
          <Target className="h-10 w-10 text-white/20" />
        </div>
      )}

      {/* Bottom scrim so the overlaid text stays legible without hiding the image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/5" />

      {/* Joined badge, top-left */}
      {campaign.isJoined ? (
        <div className="absolute left-3 top-3">
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-delulu-charcoal">
            <Check className="h-3 w-3" />
            Joined
          </span>
        </div>
      ) : null}

      {/* Prize badge, top-right */}
      {funded && poolAmount > 0 ? (
        <div className="absolute right-3 top-3">
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#D1E822] px-2.5 py-1 text-[11px] font-black text-[#244E1A]">
            <Trophy className="h-3 w-3" />
            {poolAmount} G$
          </span>
        </div>
      ) : null}

      {/* Overlaid content — title + the two things worth knowing before you tap in:
          how much longer it's open, and what joining costs. Everything else
          (description, join button, milestones) lives on the detail page. */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <h3 className="line-clamp-2 text-base font-black leading-snug text-white sm:text-lg">
          {campaign.title}
        </h3>

        <div className="mt-4 flex items-center justify-between gap-2 sm:mt-2">
          <div className="flex items-center gap-3 text-xs font-semibold text-white/85">
            <span
              className={cn(
                "flex items-center gap-1",
                !isClosed && left <= 3 && "text-amber-300",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {isClosed ? "Ended" : left === 0 ? "Ends today" : `${left}d left`}
            </span>
            {campaign.participantCount > 0 ? (
              <span className="flex items-center gap-1.5">
                {campaign.participantAvatars && campaign.participantAvatars.length > 0 ? (
                  <AvatarStack
                    participants={campaign.participantAvatars}
                    total={campaign.participantCount}
                    size={18}
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
            <span className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-white">
              {stakeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function CampaignExploreCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[1/1] animate-pulse overflow-hidden rounded-2xl bg-muted sm:aspect-[4/5]",
        className,
      )}
    >
      <div className="absolute right-3 top-3 h-6 w-16 rounded-full bg-background/60" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="h-5 w-3/4 rounded-lg bg-background/60" />
        <div className="mt-2.5 h-4 w-1/2 rounded-lg bg-background/60" />
      </div>
    </div>
  );
}
