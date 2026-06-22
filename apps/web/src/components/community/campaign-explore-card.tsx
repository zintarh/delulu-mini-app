"use client";

import Link from "next/link";
import Image from "next/image";
import { Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded } from "@/lib/community/campaign-types";
import { CampaignActionButton } from "@/components/community/campaign-horizontal-card";

export type CampaignExploreCardData = {
  id: string;
  title: string;
  proposedPoolAmount: number;
  durationDays: number;
  coverImageUrl: string | null;
  displayEndsAt: string | null;
  status: string;
  participantCount: number;
  milestoneCount: number;
  isJoined: boolean;
  community: { name: string; slug: string } | null;
};

function daysLeft(displayEndsAt: string | null, durationDays: number) {
  if (!displayEndsAt) return durationDays;
  return Math.max(0, Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000));
}

export function CampaignExploreCard({
  campaign,
  joining,
  onJoin,
}: {
  campaign: CampaignExploreCardData;
  joining: boolean;
  onJoin: () => void;
}) {
  const href = `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
  const funded = isCampaignFunded(campaign.status);
  const poolAmount = campaign.proposedPoolAmount;
  const left = daysLeft(campaign.displayEndsAt, campaign.durationDays);
  const hasMilestones = campaign.milestoneCount > 0;

  return (
    <article className="flex flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <Link href={href} className="block">
        <div className="relative mb-4 aspect-[3/2] w-full overflow-hidden rounded-2xl bg-delulu-blue-light/60">
          {campaign.coverImageUrl ? (
            <Image
              src={campaign.coverImageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-delulu-blue/50">
              <Target className="h-12 w-12" />
            </span>
          )}
        </div>
        <p
          className="line-clamp-2 text-base font-bold leading-snug text-foreground sm:text-lg"
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          {campaign.title}
        </p>
        <p className="mt-1.5 truncate text-sm text-muted-foreground">
          {campaign.community?.name ?? "Community"} · {left}d left
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {funded && poolAmount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fffbeb] px-2.5 py-1 text-sm font-bold text-[#9a7b0a]">
              <Trophy className="h-3.5 w-3.5" />
              {poolAmount} G$ prize pool
            </span>
          ) : poolAmount > 0 ? (
            <span className="text-sm text-muted-foreground">
              {poolAmount} G$ proposed ·{" "}
              <span className="font-medium text-foreground/80">not funded</span>
            </span>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">Not funded</span>
          )}
          {campaign.participantCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {campaign.participantCount}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="mt-4">
        {campaign.isJoined ? (
          <CampaignActionButton href={href} variant="muted" fullWidth>
            Joined · View →
          </CampaignActionButton>
        ) : hasMilestones ? (
          <CampaignActionButton disabled={joining} onClick={onJoin} fullWidth>
            {joining ? "Joining…" : "Join"}
          </CampaignActionButton>
        ) : (
          <CampaignActionButton href={href} variant="muted" fullWidth>
            Milestones coming soon
          </CampaignActionButton>
        )}
      </div>
    </article>
  );
}

export function CampaignExploreCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex animate-pulse flex-col rounded-2xl border border-border/60 bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-4 aspect-[3/2] w-full rounded-2xl bg-muted" />
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-4 w-1/2 rounded bg-muted/80" />
      <div className="mt-4 h-9 w-full rounded-xl bg-muted" />
    </div>
  );
}
