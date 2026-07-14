"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Clock, Loader2, Star, Target, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCampaignFunded, isCampaignEndedByDate } from "@/lib/community/campaign-types";
import {
  canSubmitMilestone,
  formatMilestoneOpensAt,
} from "@/lib/community/milestone-submit-eligibility";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
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
  joining,
  onJoin,
  onSubmitMilestone,
  proofBusy,
}: {
  campaign: CampaignExploreCardData;
  joining: boolean;
  onJoin: () => void;
  onSubmitMilestone?: () => void;
  proofBusy?: boolean;
}) {
  const href = `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
  const funded = isCampaignFunded(campaign.status);
  const isClosed = isCampaignEndedByDate(campaign.displayEndsAt);
  const poolAmount = campaign.proposedPoolAmount;
  const hasMilestones = campaign.milestoneCount > 0;
  const canJoin = !isClosed && (campaign.canJoin ?? false);
  const isOnChain = campaign.isOnChain ?? canJoin;
  const left = daysLeft(campaign.displayEndsAt, campaign.durationDays);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      {/* Image header */}
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] sm:aspect-[3/1] overflow-hidden bg-delulu-blue-light/40">
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

          {/* Prize badge top-right */}
          {funded && poolAmount > 0 ? (
            <div className="absolute right-3 top-3">
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#D1E822] px-2.5 py-1 text-[11px] font-black text-[#244E1A]">
                <Trophy className="h-3 w-3" />
                {poolAmount} G$
              </span>
            </div>
          ) : null}

          {/* Closed overlay */}
          {isClosed ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/60 py-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                Closed
              </span>
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div className="px-5 pt-5 pb-2">
          <h3
            className="line-clamp-2 text-lg font-black leading-snug text-foreground sm:text-xl"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {campaign.title}
          </h3>

          {(() => {

            return (
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {isClosed ? "Ended" : left === 0 ? "Ends today" : `${left}d left`}
                </span>
                {campaign.participantCount > 0 ? (
                  <span className="flex items-center gap-1.5">
                    {campaign.participantAvatars && campaign.participantAvatars.length > 0 ? (
                      <AvatarStack
                        participants={campaign.participantAvatars}
                        total={campaign.participantCount}
                        size={20}
                      />
                    ) : (
                      <Users className="h-3.5 w-3.5" />
                    )}
                  joined
                  </span>
                ) : null}

              </div>
            );
          })()}

          {/* Stakes strip — only for paid campaigns */}
          {campaign.isFreeToJoin === false && (campaign.joinAmount ?? 0) > 0 ? (() => {
            const forfeitAmt = (campaign.forfeitPct ?? 0) > 0
              ? Math.round((campaign.joinAmount ?? 0) * (campaign.forfeitPct ?? 0) / 100)
              : 0;

              const token = campaign.joinToken ?? "G$";
              const totalStaked = campaign.isFreeToJoin === false
                ? (campaign.joinAmount ?? 0) * campaign.participantCount
                : 0;
            return (
              <div className="mt-3 rounded-xl border border-delulu-blue/25 bg-delulu-blue-light/30 px-3.5 py-2.5 space-y-1.5">
                {forfeitAmt > 0 ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Miss your milestone — forfeit {campaign.forfeitPct}% of your stake
                  </p>
                ) : null}
               <div className="flex justify-between items-center">
               <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  Top {campaign.prizeWinnerCount ?? 0} split the forfeit pool
                </p>

                {/* <p className="flex items-center font-extrabold gap-1.5 text-[14px]  text-foreground">
                  {totalStaked} {token} <span className="text-[11px] font-normal">staked</span>
                </p> */}
               </div>
              </div>
            );
          })() : null}


          {/* Points motivator — only for non-joined, non-closed campaigns */}
          {!isClosed && !campaign.isJoined ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-delulu-blue">
              <Star className="h-3.5 w-3.5 shrink-0" />
              Complete milestones, earn points &amp; qualify for rewards
            </p>
          ) : null}
        </div>
      </Link>

      {/* Inline milestone block — joined campaigns only */}
      {campaign.isJoined && campaign.activeMilestone && !isClosed ? (() => {
        const m = campaign.activeMilestone!;
        const canSubmit = canSubmitMilestone(m as Parameters<typeof canSubmitMilestone>[0]);
        const waitLabel = m.start_time ? formatMilestoneOpensAt(m.start_time) : "Opens soon";
        const countdown = (() => {
          if (!m.deadline) return null;
          const ms = new Date(m.deadline).getTime() - Date.now();
          if (ms <= 0) return "Overdue";
          const days = Math.floor(ms / 86400000);
          if (days >= 1) return `${days}d left`;
          return `${Math.ceil(ms / 3600000)}h left`;
        })();
        return (
          <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-delulu-blue/30 bg-delulu-blue-light/40">
            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-delulu-blue/70">
                {canSubmit ? "Today's milestone" : "Up next"}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-black text-delulu-blue">
                  <Star className="h-3.5 w-3.5 fill-delulu-blue text-delulu-blue" />
                  +{BASE_PROOF_POINTS.toLocaleString()} pts
                </span>
                {countdown ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {countdown}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-4">
              <p className="min-w-0 flex-1 text-base font-bold leading-snug text-foreground line-clamp-2">
                {m.label}
              </p>
              {canSubmit ? (
                <button
                  type="button"
                  disabled={proofBusy}
                  onClick={onSubmitMilestone}
                  className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-transform hover:opacity-90 active:scale-[0.96] disabled:opacity-50"
                >
                  {proofBusy ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />…
                    </span>
                  ) : (
                    "Upload proof"
                  )}
                </button>
              ) : (
                <span className="shrink-0 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {waitLabel}
                </span>
              )}
            </div>
            <div className="border-t border-delulu-blue/15 px-4 py-2">
              <Link href={href} className="text-xs font-semibold text-delulu-blue/70 hover:text-delulu-blue">
                See all milestones →
              </Link>
            </div>
          </div>
        );
      })() : null}

      {/* CTA row — pinned to the bottom regardless of how much content is above it,
          so Join buttons line up across cards in the same grid row */}
      <div className="mt-auto flex items-center gap-2 px-5 pb-5 pt-4">
        <div className="flex-1">
          {isClosed ? (
            <div className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-base font-semibold text-muted-foreground">
              Campaign ended
            </div>
          ) : campaign.isJoined ? (
            <Link
              href={href}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-base font-bold text-foreground transition-colors hover:bg-muted/60"
            >
              {campaign.activeMilestone ? "View campaign →" : "Joined · View →"}
            </Link>
          ) : canJoin ? (
            <button
              type="button"
              disabled={joining}
              onClick={onJoin}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-base font-bold text-background transition-transform hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {joining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Joining…
                </>
              ) : campaign.isFreeToJoin !== false ? (
                "Join free →"
              ) : (
                `Join  ·  Stake ${campaign.joinAmount ?? 0} ${campaign.joinToken ?? "G$"}`
              )}
            </button>
          ) : isOnChain ? (
            <Link
              href={href}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-base font-semibold text-muted-foreground"
            >
              Finalizing on-chain…
            </Link>
          ) : hasMilestones ? (
            <Link
              href={href}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-base font-semibold text-muted-foreground"
            >
              Pending on-chain registration
            </Link>
          ) : (
            <Link
              href={href}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-base font-semibold text-muted-foreground"
            >
              Milestones coming soon
            </Link>
          )}
        </div>

      </div>
    </article>
  );
}

export function CampaignExploreCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-sm", className)}>
      <div className="relative aspect-[16/9] animate-pulse bg-muted sm:aspect-[3/1]">
        <div className="absolute right-3 top-3 h-6 w-16 rounded-full bg-background/60" />
      </div>

      <div className="animate-pulse px-5 pt-5 pb-2">
        <div className="h-6 w-3/4 rounded-lg bg-muted" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-4 w-16 rounded-lg bg-muted/80" />
          <div className="h-4 w-20 rounded-lg bg-muted/80" />
        </div>
        <div className="mt-3 h-4 w-2/3 rounded-lg bg-muted/60" />
      </div>

      <div className="mt-auto animate-pulse px-5 pb-5 pt-4">
        <div className="h-12 w-full rounded-full bg-muted" />
      </div>
    </div>
  );
}
