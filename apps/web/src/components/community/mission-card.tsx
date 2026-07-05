"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Loader2, Star, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canSubmitMilestone,
  formatMilestoneOpensAt,
} from "@/lib/community/milestone-submit-eligibility";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { AvatarStack, type AvatarStackParticipant } from "@/components/ui/avatar-stack";

export interface MissionCardProps {
  href: string;
  title: string;
  coverImageUrl: string | null;
  milestone: CommunityCampaignMilestoneRow;
  /** 1-based position of the current milestone, e.g. day 3 of 7 */
  milestoneIndex: number;
  milestoneCount: number;
  proofBusy?: boolean;
  onSubmitProof: () => void;
  isFreeToJoin: boolean;
  joinAmount: number;
  joinToken: string;
  forfeitPct: number;
  participantCount: number;
  participantAvatars?: AvatarStackParticipant[];
}

function countdownLabel(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { text: "Overdue", urgent: true };
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return { text: `${days}d left`, urgent: days <= 1 };
  return { text: `${Math.ceil(ms / 3600000)}h left`, urgent: true };
}

// Cute, compact "how far you've come / how far to go" indicator — a ring
// scales to any campaign length without needing one dot per day.
function ProgressRing({ index, count }: { index: number; count: number }) {
  const size = 38;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = count > 0 ? Math.min(1, Math.max(0, index / count)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div
      className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-full bg-card shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-amber-500 transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[12px] font-black leading-none text-foreground">
        {index}
      </span>
    </div>
  );
}

// Duolingo-style: lead with a concrete "Day N" marker (loss aversion — a real
// number you'd hate to abandon) and pair it with a line that shifts tone as
// the journey progresses, so the card feels like momentum, not a form field.
function momentumLine(index: number, count: number): string {
  if (count <= 1) return "This is the one — make it count.";
  if (index <= 1) return "Day one. Every streak starts here.";
  if (index >= count) return "Final day. Finish what you started.";
  if (count - index === 1) return "One more after this. So close.";
  return "You're on a roll — don't break it now.";
}

export function MissionCard({
  href,
  title,
  coverImageUrl,
  milestone,
  milestoneIndex,
  milestoneCount,
  proofBusy,
  onSubmitProof,
  isFreeToJoin,
  joinAmount,
  joinToken,
  forfeitPct,
  participantCount,
  participantAvatars,
}: MissionCardProps) {
  const canSubmit = canSubmitMilestone(milestone);
  const waitLabel = milestone.start_time
    ? formatMilestoneOpensAt(milestone.start_time)
    : "Opens soon";
  const countdown = countdownLabel(milestone.deadline);
  const hasStake = !isFreeToJoin && joinAmount > 0;
  const atRisk = hasStake && forfeitPct > 0 && Boolean(countdown?.urgent);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3.5">
        <Link href={href} className="relative shrink-0">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-delulu-blue-light/40">
            {coverImageUrl ? (
              <Image src={coverImageUrl} alt="" fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Target className="h-7 w-7 text-delulu-blue/40" />
              </div>
            )}
          </div>
          {milestoneCount > 0 ? (
            <ProgressRing index={milestoneIndex} count={milestoneCount} />
          ) : null}
        </Link>

        <Link href={href} className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            {title}
          </p>

          <p className="mt-1 truncate text-base font-bold leading-snug text-foreground">
            {milestone.label}
          </p>

          {/* <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
            {momentumLine(milestoneIndex, milestoneCount)}
          </p> */}

          {participantCount > 1 ? (
            <div className="mt-1 flex items-center gap-1.5">
              {participantAvatars && participantAvatars.length > 0 ? (
                <AvatarStack participants={participantAvatars} total={participantCount} size={18} />
              ) : (
                <Users className="h-3 w-3 shrink-0 text-foreground" />
              )}
              <p className="truncate text-[11px] font-medium text-foreground">
                {participantCount} people are in this together
              </p>
            </div>
          ) : null}
        </Link>
      </div>

      {/* Motivation strip — the reward, the urgency, what's at stake */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/40 pt-3 text-[11px]">
        {countdown ? (
          <span className="flex items-center gap-1 font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {countdown.text}
          </span>
        ) : null}

        <span className="flex items-center gap-1 font-semibold text-delulu-blue">
          <Star className="h-3 w-3 fill-delulu-blue" />
          +{BASE_PROOF_POINTS.toLocaleString()} pts
        </span>

        {atRisk ? (
          <span className="font-semibold text-amber-600">
            Miss it, forfeit {forfeitPct}% of your stake
          </span>
        ) : hasStake ? (
          <span className="text-muted-foreground">
            {joinAmount} {joinToken} staked
          </span>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit || proofBusy}
          onClick={onSubmitProof}
          className={cn(
            "ml-auto shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors",
            canSubmit
              ? "bg-delulu-blue text-white hover:opacity-90 disabled:opacity-50"
              : "bg-muted text-muted-foreground",
          )}
        >
          {proofBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : canSubmit ? (
            "Upload proof"
          ) : (
            waitLabel
          )}
        </button>
      </div>
    </div>
  );
}

export function MissionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3.5">
        <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-16 rounded-full bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted/70" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
        <div className="h-2.5 w-24 rounded bg-muted/70" />
        <div className="h-8 w-24 shrink-0 rounded-full bg-muted" />
      </div>
    </div>
  );
}
