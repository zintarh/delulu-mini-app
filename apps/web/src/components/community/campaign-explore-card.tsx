"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Trophy } from "lucide-react";
import { Stamp, Trophy as TrophyArt } from "@/components/ds";
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
      ? `Join · Stake ${(campaign.joinAmount ?? 0).toLocaleString("en-US")} ${campaign.joinToken ?? "G$"}`
      : "Join free";

  const endsLabel = isClosed
    ? "Ended"
    : left == null
      ? `${campaign.durationDays}d`
      : left === 0
        ? "Today"
        : `${left}d`;

  return (
    <Link
      href={href}
      className={cn(
        "press-edge group block overflow-hidden rounded-3xl border-2 border-line bg-white text-ink no-underline shadow-edge",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-blue-soft", compact ? "h-20" : "h-[120px]")}>
        {campaign.coverImageUrl ? (
          <Image
            src={campaign.coverImageUrl}
            alt=""
            fill
            className={cn("object-cover transition-transform duration-300 group-hover:scale-105", isClosed && "grayscale")}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-end pr-5">
            <TrophyArt size={compact ? 44 : 64} />
          </div>
        )}
        {campaign.isJoined ? (
          <span className="absolute left-3 top-3">
            <Stamp tone="kept" className="text-[10px]">
              <Check className="h-3 w-3" strokeWidth={3} />
              Joined
            </Stamp>
          </span>
        ) : null}
        {funded && poolAmount > 0 ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow px-2.5 py-1 text-[11px] font-extrabold text-ink shadow-[0_2px_0_#c99a0a]">
            <Trophy className="h-3 w-3" strokeWidth={2.6} />
            {poolAmount.toLocaleString()} G$ prize
          </span>
        ) : null}
      </div>

      <div className={cn(compact ? "p-3" : "p-4")}>
        {campaign.community?.name ? (
          <div className="label-mono truncate text-[10px] text-blue">{campaign.community.name}</div>
        ) : null}
        <h3 className={cn("mt-1 font-bold leading-snug", compact ? "line-clamp-1 text-[15px]" : "line-clamp-2 text-[19px]")}>
          {campaign.title}
        </h3>

        <div className={cn("grid grid-cols-3 gap-2", compact ? "mt-2" : "mt-4")}>
          <div>
            <div className="font-display text-2xl font-extrabold leading-none">
              {funded && poolAmount > 0 ? poolAmount.toLocaleString() : "—"}
            </div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">G$ pool</div>
          </div>
          <div>
            <div className="flex items-center gap-1 font-display text-2xl font-extrabold leading-none">
              {campaign.participantAvatars && campaign.participantAvatars.length > 0 && !compact ? (
                <AvatarStack participants={campaign.participantAvatars} total={campaign.participantCount} size={18} />
              ) : (
                campaign.participantCount
              )}
            </div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">Joined</div>
          </div>
          <div>
            <div
              className={cn(
                "font-display text-2xl font-extrabold leading-none",
                !isClosed && left != null && left <= 3 && "text-orange",
              )}
            >
              {endsLabel}
            </div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">{isClosed ? "Status" : "Left"}</div>
          </div>
        </div>

        {!isClosed && !compact ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full bg-yellow-soft px-3 py-1 text-xs font-bold">{stakeLabel}</span>
            <span className="text-sm font-bold text-muted-foreground transition-colors group-hover:text-ink">View →</span>
          </div>
        ) : null}
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
        "relative animate-pulse overflow-hidden rounded-3xl border-2 border-line bg-white",
        compact ? "h-[170px]" : "h-[300px]",
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
