"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded } from "@/lib/community/campaign-types";

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
  const hasMilestones = campaign.milestoneCount > 0;
  const communityName = campaign.community?.name ?? "Community";
  const left = daysLeft(campaign.displayEndsAt, campaign.durationDays);

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Image header */}
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-delulu-blue-light/40">
          {campaign.coverImageUrl ? (
            <Image
              src={campaign.coverImageUrl}
              alt=""
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]">
              <Target className="h-10 w-10 text-white/20" />
            </div>
          )}

          {/* Subtle vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />

          {/* Top: community + prize */}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <span className="max-w-[60%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              {communityName}
            </span>
            {funded && poolAmount > 0 ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-black">
                <Trophy className="h-3 w-3" />
                {poolAmount} G$
              </span>
            ) : null}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-3.5 pb-1">
          <h3
            className="line-clamp-2 text-base font-black leading-snug text-foreground sm:text-lg"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {campaign.title}
          </h3>

          {campaign.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {campaign.description}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{left}d campaign</span>
            {campaign.participantCount > 0 ? (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {campaign.participantCount} joined
              </span>
            ) : null}
            {hasMilestones ? (
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {campaign.milestoneCount} milestones
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {/* CTA */}
      <div className="px-4 pb-4 pt-3">
        {campaign.isJoined ? (
          <Link
            href={href}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-sm font-bold text-foreground hover:bg-muted/60"
          >
            Joined · View →
          </Link>
        ) : hasMilestones ? (
          <button
            type="button"
            disabled={joining}
            onClick={onJoin}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-delulu-blue text-sm font-bold text-white shadow-[0_2px_12px_rgba(37,99,235,0.3)] hover:bg-delulu-blue/90 disabled:opacity-60"
          >
            {joining ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining…
              </>
            ) : (
              "Join campaign →"
            )}
          </button>
        ) : (
          <Link
            href={href}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-sm font-semibold text-muted-foreground"
          >
            Milestones coming soon
          </Link>
        )}
      </div>
    </article>
  );
}

export function CampaignExploreCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card", className)}>
      <div className="animate-pulse">
        <div className="aspect-[16/9] bg-muted" />
        <div className="p-4 space-y-2.5">
          <div className="h-5 w-3/4 rounded-lg bg-muted" />
          <div className="h-4 w-1/2 rounded-lg bg-muted/80" />
          <div className="h-10 w-full rounded-xl bg-muted mt-4" />
        </div>
      </div>
    </div>
  );
}
