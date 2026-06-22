"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded } from "@/lib/community/campaign-types";

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

  return (
    <article className="relative overflow-hidden rounded-2xl bg-black shadow-[0_4px_20px_rgba(0,0,0,0.14)]">
      <div className="relative aspect-[3/4]">
        {/* Cover image or fallback */}
        {campaign.coverImageUrl ? (
          <Image
            src={campaign.coverImageUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]">
            <Target className="h-12 w-12 text-white/20" />
          </div>
        )}

        {/* Gradient overlay — heavier at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

        {/* Top: community pill + prize badge */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="max-w-[65%] truncate rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {communityName}
          </span>
          {funded && poolAmount > 0 ? (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-black text-black">
              <Trophy className="h-2.5 w-2.5" />
              {poolAmount} G$
            </span>
          ) : null}
        </div>

        {/* Bottom: stats + title + CTA */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/60">
            <Users className="h-3 w-3 shrink-0" />
            {campaign.participantCount > 0
              ? `${campaign.participantCount} joined`
              : `${campaign.durationDays}d`}
            {hasMilestones ? ` · ${campaign.milestoneCount} milestones` : ""}
          </p>
          <h3
            className="mb-3 line-clamp-2 text-sm font-black leading-tight text-white sm:text-base"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {campaign.title}
          </h3>

          {campaign.isJoined ? (
            <Link
              href={href}
              className="block w-full rounded-xl bg-white/20 py-2.5 text-center text-xs font-bold text-white backdrop-blur-sm"
            >
              Joined · View →
            </Link>
          ) : hasMilestones ? (
            <button
              type="button"
              disabled={joining}
              onClick={onJoin}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-black text-black hover:bg-white/90 disabled:opacity-70"
            >
              {joining ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Joining…
                </>
              ) : (
                "Join →"
              )}
            </button>
          ) : (
            <Link
              href={href}
              className="block w-full rounded-xl bg-white/10 py-2.5 text-center text-xs font-bold text-white/50 backdrop-blur-sm"
            >
              Milestones soon
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function CampaignExploreCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted", className)}>
      <div className="animate-pulse aspect-[3/4] bg-gradient-to-br from-muted to-muted-foreground/10" />
    </div>
  );
}
