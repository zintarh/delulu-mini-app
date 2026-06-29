"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  Clock,
  Flame,
  Loader2,
  Share2,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { ProofModal } from "@/components/proof-modal";
import { CommunityCampaignMilestoneList } from "@/components/community/community-campaign-milestone-list";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { cn, formatAddress } from "@/lib/utils";
import { formatLeaderboardDisplayName } from "@/lib/community/enrich-leaderboard-usernames";
import {
  formatMilestoneOpensAt,
  getActiveMilestone,
  getUpcomingMilestone,
} from "@/lib/community/milestone-submit-eligibility";
import { isCampaignFunded, isCampaignEndedByDate } from "@/lib/community/campaign-types";

export type CommunityCampaignDetailData = {
  id: string;
  title: string;
  description: string | null;
  proof_instructions: string | null;
  proof_cadence: string;
  proposed_pool_amount: number;
  cover_image_url: string | null;
  status: string;
  display_ends_at: string | null;
  duration_days: number;
  prize_winner_count: number;
  on_chain_challenge_id?: number | null;
  telegram_link?: string | null;
  is_free_to_join?: boolean;
  join_token?: string | null;
  join_amount?: number | null;
  forfeit_pct?: number | null;
  communities?: {
    name: string;
    slug: string;
    description: string | null;
  };
};

export type CampaignPoolStats = {
  fundedPoolAmount: number;
  totalParticipantStakes: number;
  totalPrizePoolAmount: number;
  joinTokenLabel: string;
  isPaidOnChain: boolean;
  joinAmountOnChain: number;
};

export type CampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
  username?: string | null;
  points_total: number;
  is_community_member: boolean;
};

type ProofStep = "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming";

function formatEndsAt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysRemaining(displayEndsAt: string | null, durationDays: number) {
  if (!displayEndsAt) return durationDays;
  return Math.max(0, Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000));
}

function milestoneCountdown(deadline: string) {
  if (!deadline) return "Pending start";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.ceil(ms / 3600000);
  return `${hours}h left`;
}

function JoinButton({
  joining,
  canJoin,
  onJoin,
  className,
  size = "default",
}: {
  joining: boolean;
  canJoin: boolean;
  onJoin: () => void;
  className?: string;
  size?: "default" | "large";
}) {
  return (
    <button
      type="button"
      disabled={joining || !canJoin}
      onClick={onJoin}
      className={cn(
        "rounded-xl font-bold transition-all active:scale-[0.98]",
        canJoin
          ? "bg-delulu-blue text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-delulu-blue/90"
          : "bg-muted text-muted-foreground",
        size === "large" ? "px-6 py-3.5 text-sm" : "px-5 py-2.5 text-sm",
        className,
      )}
    >
      {joining ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Joining…
        </span>
      ) : canJoin ? (
        "Join campaign"
      ) : (
        "Finalizing on-chain…"
      )}
    </button>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[88px] shrink-0 flex-col rounded-xl border px-3 py-2.5",
        accent
          ? "border-[#f6c324]/40 bg-gradient-to-br from-[#fffbeb] to-white"
          : "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", accent && "text-[#9a7b0a]")} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("mt-0.5 text-sm font-black tabular-nums", accent && "text-[#9a7b0a]")}>
        {value}
      </p>
    </div>
  );
}

export function CommunityCampaignDetail({
  campaign,
  communitySlug,
  leaderboard,
  participantCount,
  isJoined,
  isCommunityMember,
  address,
  authenticated,
  joining,
  myPoints,
  myStreak = 0,
  myRank,
  milestoneCount = 0,
  canJoin = false,
  milestones = [],
  proofOpen,
  proofBusy,
  proofSuccess,
  proofError,
  proofStep = "idle",
  activeMilestoneId,
  actionError,
  poolStats,
  onJoin,
  onOpenProof,
  onProofOpenChange,
  onProofSubmit,
  onProofDone,
}: {
  campaign: CommunityCampaignDetailData;
  communitySlug: string;
  leaderboard: CampaignLeaderboardRow[];
  participantCount: number;
  isJoined: boolean;
  isCommunityMember: boolean;
  address: string | undefined;
  authenticated: boolean;
  joining: boolean;
  myPoints: number;
  myStreak?: number;
  myRank?: number;
  milestoneCount?: number;
  canJoin?: boolean;
  milestones?: CommunityCampaignMilestoneRow[];
  proofOpen: boolean;
  proofBusy: boolean;
  proofSuccess: boolean;
  proofError: string | null;
  proofStep?: ProofStep;
  activeMilestoneId?: number | null;
  actionError: string | null;
  poolStats?: CampaignPoolStats | null;
  onJoin: () => void;
  onOpenProof: (milestoneId: number) => void;
  onProofOpenChange: (open: boolean) => void;
  onProofSubmit: (imageUrl: string) => void;
  onProofDone: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const handleInvite = useCallback(async () => {
    const url = `${window.location.origin}/communities/${communitySlug}/campaigns/${campaign.id}`;
    await navigator.clipboard.writeText(url).catch(() => null);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }, [campaign.id, communitySlug]);
  const MILESTONES_PREVIEW = 4;
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const funded = isCampaignFunded(campaign.status);
  const endsLabel = formatEndsAt(campaign.display_ends_at);
  const daysLeft = daysRemaining(campaign.display_ends_at, campaign.duration_days ?? 30);
  const topN = campaign.prize_winner_count ?? 10;
  const communityName = campaign.communities?.name ?? "Community";
  const fundedPool =
    poolStats?.fundedPoolAmount ??
    (funded && campaign.proposed_pool_amount > 0 ? campaign.proposed_pool_amount : 0);
  const participantStakes = poolStats?.totalParticipantStakes ?? 0;
  const stakeToken = poolStats?.joinTokenLabel ?? campaign.join_token ?? "G$";
  const totalPrizePool =
    poolStats?.totalPrizePoolAmount ?? fundedPool + participantStakes;
  const showPrizePool = totalPrizePool > 0 || participantStakes > 0 || fundedPool > 0;
  const isPaidJoin =
    poolStats?.isPaidOnChain ??
    (campaign.is_free_to_join === false && Number(campaign.join_amount ?? 0) > 0);
  const joinStakeAmount =
    poolStats?.joinAmountOnChain ?? Number(campaign.join_amount ?? 0);

  const myLeaderboardRow = address
    ? leaderboard.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase())
    : undefined;
  const inPrizeZone = myLeaderboardRow ? myLeaderboardRow.rank <= topN : false;
  const showClaimNote = inPrizeZone && isJoined && !isCommunityMember && funded;

  const completedCount = milestones.filter((m) => m.completed).length;

  const activeMilestone = useMemo(
    () => getActiveMilestone(milestones),
    [milestones],
  );
  const upcomingMilestone = useMemo(
    () => getUpcomingMilestone(milestones),
    [milestones],
  );
  const focusMilestone = activeMilestone ?? upcomingMilestone;

  const isClosed = isCampaignEndedByDate(campaign.display_ends_at);

  const campaignPhase = useMemo(() => {
    if (isClosed) return "closed" as const;
    if (milestoneCount === 0) return "setup" as const;
    if (isJoined) return "active" as const;
    return "open" as const;
  }, [isClosed, milestoneCount, isJoined]);

  const phaseLabel = {
    closed: "Closed",
    setup: "Setting up",
    open: "Open to join",
    active: "You're in",
  }[campaignPhase];

  const phaseClass = {
    closed: "bg-muted text-muted-foreground border-border/60",
    setup: "bg-[#fffbeb] text-[#9a7b0a] border-[#f6c324]/40",
    open: "bg-delulu-blue-light text-delulu-blue border-delulu-blue/30",
    active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  }[campaignPhase];

  /* ─── Hero (slimmer for joined users) ─── */
  const heroAspect = isJoined ? "aspect-[2/1]" : "aspect-[16/9] sm:aspect-[2/1]";

  return (
    <>
      <main className="mx-auto max-w-2xl pb-28">

        {/* ── Back nav + Hero ── */}
        <div className="relative px-4 pt-2">
          <Link
            href={`/communities/${communitySlug}`}
            className="mb-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {communityName}
          </Link>

          <div className="relative overflow-hidden rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            {campaign.cover_image_url ? (
              <div className={cn("relative w-full", heroAspect)}>
                <Image
                  src={campaign.cover_image_url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
              </div>
            ) : (
              <div
                className={cn(
                  "w-full bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]",
                  heroAspect,
                )}
              />
            )}

            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    phaseClass,
                  )}
                >
                  {phaseLabel}
                </span>
                {showPrizePool ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#f6c324]/50 bg-[#f6c324]/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1a1a19]">
                    <Trophy className="h-3 w-3" />
                    {participantStakes > 0 && stakeToken !== "G$" && fundedPool > 0
                      ? `${fundedPool} G$ + ${participantStakes} ${stakeToken}`
                      : `${totalPrizePool} G$`}{" "}
                    pool
                  </span>
                ) : funded && campaign.proposed_pool_amount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#f6c324]/50 bg-[#f6c324]/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1a1a19]">
                    <Trophy className="h-3 w-3" />
                    {campaign.proposed_pool_amount} G$ pool
                  </span>
                ) : null}
              </div>
              <h1
                className="text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {campaign.title}
              </h1>
              {/* Description only shown on hero for non-joined (evaluators need context) */}
              {!isJoined && campaign.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/85">
                  {campaign.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Hosted by + Invite ── */}
        <div className="mt-4 flex items-center justify-between gap-3 px-4">
          <p className="text-[11px] text-muted-foreground">
            Hosted by{" "}
            <Link
              href={`/communities/${communitySlug}`}
              className="font-semibold text-foreground hover:underline"
            >
              {communityName}
            </Link>
          </p>
          <div className="flex items-center gap-2">
            {campaign.telegram_link ? (
              <a
                href={campaign.telegram_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-3 py-1.5 text-xs font-semibold text-[#1a8cc7] hover:bg-[#2AABEE]/20 transition-colors"
              >
                Join Telegram
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void handleInvite()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              {inviteCopied ? "Link copied!" : "Invite friends"}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            JOINED PATH — action-first layout
            ════════════════════════════════════════════ */}
        {isJoined ? (
          <>
            {/* "Today's proof" card */}
            <div className="mx-4 mt-4">
              {focusMilestone ? (
                <div className="overflow-hidden rounded-2xl border border-delulu-blue/30 bg-delulu-blue-light/30">
                  <div className="flex items-start gap-3 border-l-4 border-delulu-blue p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-delulu-blue">
                          {activeMilestone ? "Today's proof" : "Up next"}
                        </p>
                        {myStreak > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-600">
                            <Flame className="h-3 w-3" />
                            {myStreak} streak
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-foreground">
                        {focusMilestone.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {activeMilestone
                          ? milestoneCountdown(activeMilestone.deadline)
                          : formatMilestoneOpensAt(focusMilestone.start_time)}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-delulu-blue/20 px-4 pb-4 pt-3">
                    <button
                      type="button"
                      disabled={proofBusy || !activeMilestone}
                      onClick={() => {
                        if (!activeMilestone) return;
                        onOpenProof(activeMilestone.milestone_id);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-delulu-blue py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.3)] hover:bg-delulu-blue/90 disabled:opacity-50"
                    >
                      {proofBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting…
                        </>
                      ) : activeMilestone ? (
                        "Submit proof"
                      ) : (
                        formatMilestoneOpensAt(focusMilestone.start_time)
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // All milestones complete
                <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/8">
                  <div className="border-l-4 border-emerald-500 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      🎉 All milestones complete
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {myRank
                        ? `You're ranked #${myRank}`
                        : "Waiting for campaign to end"}
                      {myPoints > 0 ? ` · ${myPoints} pts` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress strip (compact chips) */}
            <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
              <span className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-bold tabular-nums text-foreground">
                {completedCount}/{milestoneCount} milestones
              </span>
              {myPoints > 0 ? (
                <span className="rounded-lg bg-delulu-blue-light px-2.5 py-1.5 text-xs font-bold tabular-nums text-delulu-blue">
                  {myPoints} pts
                </span>
              ) : null}
              {myRank ? (
                <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground">
                  Rank #{myRank}
                </span>
              ) : null}
              <span className="rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                {daysLeft}d left
              </span>
            </div>

            {actionError ? (
              <p className="mx-4 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {actionError}
              </p>
            ) : null}

            {/* All milestones */}
            <section className="mt-5 px-4">
              <h2
                className="mb-3 text-base font-black text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                Milestones
              </h2>
              <CommunityCampaignMilestoneList
                milestones={showAllMilestones ? milestones : milestones.slice(0, MILESTONES_PREVIEW)}
                isJoined={isJoined}
                proofBusy={proofBusy}
                activeMilestoneId={activeMilestoneId}
                onSubmitMilestone={onOpenProof}
              />
              {milestones.length > MILESTONES_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAllMilestones((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center rounded-xl border border-border/60 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {showAllMilestones
                    ? "Show less"
                    : `Show ${milestones.length - MILESTONES_PREVIEW} more milestone${milestones.length - MILESTONES_PREVIEW !== 1 ? "s" : ""}`}
                </button>
              ) : null}
            </section>

            {/* Campaign details — collapsible */}
            <section className="mt-6 px-4">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-bold text-foreground"
              >
                Campaign details
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    detailsOpen && "rotate-180",
                  )}
                />
              </button>
              {detailsOpen ? (
                <div className="mt-2 space-y-3">
                  {campaign.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {campaign.description}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-foreground">Win the pool</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Top {topN} on the leaderboard split the prize when the campaign ends.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#fffbeb] text-[#9a7b0a]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-foreground">Submit proof</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {campaign.proof_instructions ??
                          "Complete each milestone and upload proof to earn points."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          /* ════════════════════════════════════════════
              NON-JOINED PATH — discovery layout
              ════════════════════════════════════════════ */
          <>
            {showPrizePool ? (
              <section className="mx-4 mt-4 rounded-2xl border border-[#f6c324]/35 bg-[#fffbeb]/80 p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[#9a7b0a]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#9a7b0a]">
                    Prize pool
                  </h2>
                </div>
                <div className="mt-3 space-y-2">
                  {fundedPool > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Host funded</span>
                      <span className="font-bold text-foreground">{fundedPool} G$</span>
                    </div>
                  ) : null}
                  {participantStakes > 0 ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Participant stakes ({participantCount} joined)
                      </span>
                      <span className="font-bold text-foreground">
                        {participantStakes} {stakeToken}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between border-t border-[#f6c324]/25 pt-2 text-sm">
                    <span className="font-semibold text-foreground">Total pool</span>
                    <span className="font-black text-foreground">
                      {participantStakes > 0 && stakeToken !== "G$" && fundedPool > 0
                        ? `${fundedPool} G$ + ${participantStakes} ${stakeToken}`
                        : `${totalPrizePool} G$`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Top {topN} on the leaderboard share the pool when the campaign ends.
                  </p>
                </div>
              </section>
            ) : null}

            {isPaidJoin && joinStakeAmount > 0 ? (
              <p className="mx-4 mt-3 text-center text-xs text-muted-foreground">
                Join stake: <strong className="text-foreground">{joinStakeAmount} {stakeToken}</strong>
                {poolStats?.isPaidOnChain
                  ? " — debited from your wallet on confirm"
                  : ""}
              </p>
            ) : null}

            {/* Action card — simplified for non-joined */}
            <div className="relative z-10 mx-4 mt-3 rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ready to compete?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {milestoneCount === 0
                      ? "Host is adding milestones"
                      : `${participantCount} joined · ${daysLeft}d left`}
                  </p>
                </div>
                {!authenticated ? (
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center justify-center rounded-xl bg-delulu-blue px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-delulu-blue/90"
                  >
                    Sign in to join
                  </Link>
                ) : canJoin ? (
                  <JoinButton
                    joining={joining}
                    canJoin={canJoin}
                    onJoin={onJoin}
                    size="large"
                  />
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Not open yet</p>
                )}
              </div>
              {actionError ? (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {actionError}
                </p>
              ) : null}
            </div>

            {/* Stats strip */}
            <div className="mt-4 overflow-x-auto px-4 scrollbar-hide">
              <div className="flex gap-2 pb-1">
                {showPrizePool ? (
                  <StatPill
                    icon={Trophy}
                    label="Prize"
                    value={
                      participantStakes > 0 && stakeToken !== "G$" && fundedPool > 0
                        ? `${totalPrizePool} G$+`
                        : `${totalPrizePool} G$`
                    }
                    accent
                  />
                ) : funded && campaign.proposed_pool_amount > 0 ? (
                  <StatPill
                    icon={Trophy}
                    label="Prize"
                    value={`${campaign.proposed_pool_amount} G$`}
                    accent
                  />
                ) : null}
                <StatPill
                  icon={Target}
                  label="Milestones"
                  value={milestoneCount > 0 ? `${milestoneCount}` : "Soon"}
                />
                <StatPill icon={Clock} label="Time left" value={`${daysLeft}d`} />
                <StatPill
                  icon={Calendar}
                  label="Ends"
                  value={endsLabel ?? `${campaign.duration_days}d`}
                />
                <StatPill icon={Users} label="Winners" value={`Top ${topN}`} />
              </div>
            </div>

            {/* How it works */}
            <section className="mt-6 px-4">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                How it works
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Win the pool</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Top {topN} on the leaderboard split the prize when the campaign ends.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-3.5">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#fffbeb] text-[#9a7b0a]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Submit proof</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {campaign.proof_instructions ??
                      "Complete each milestone and upload proof to earn points."}
                  </p>
                </div>
              </div>
            </section>

            {/* Milestone preview */}
            <section className="mt-6 px-4">
              <div className="mb-3">
                <h2
                  className="text-base font-black text-foreground"
                  style={{ fontFamily: '"Clash Display", sans-serif' }}
                >
                  Milestones
                </h2>
                <p className="text-xs text-muted-foreground">
                  {milestoneCount > 0
                    ? "Complete each checkpoint before its deadline"
                    : "Checkpoints will appear here"}
                </p>
              </div>
              <CommunityCampaignMilestoneList
                milestones={showAllMilestones ? milestones : milestones.slice(0, MILESTONES_PREVIEW)}
                isJoined={false}
                proofBusy={proofBusy}
                activeMilestoneId={activeMilestoneId}
                onSubmitMilestone={onOpenProof}
              />
              {milestones.length > MILESTONES_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAllMilestones((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center rounded-xl border border-border/60 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {showAllMilestones
                    ? "Show less"
                    : `Show ${milestones.length - MILESTONES_PREVIEW} more milestone${milestones.length - MILESTONES_PREVIEW !== 1 ? "s" : ""}`}
                </button>
              ) : null}
            </section>
          </>
        )}

        {/* ── Leaderboard (always last) ── */}
        <section ref={leaderboardRef} className="mt-8 px-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2
                className="flex items-center gap-2 text-base font-black text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                <Trophy className="h-4 w-4 text-delulu-blue" />
                Leaderboard
              </h2>
              <p className="text-xs text-muted-foreground">
                {participantCount} participant{participantCount !== 1 ? "s" : ""} · top {topN} win
              </p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-card px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-delulu-blue-light text-delulu-blue">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-foreground">No one on the board yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Be the first to join and claim the top spot.
              </p>
              {!isJoined && authenticated && canJoin ? (
                <div className="mt-4 flex justify-center">
                  <JoinButton joining={joining} canJoin={canJoin} onJoin={onJoin} />
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {leaderboard.map((row) => {
                const isMe = address?.toLowerCase() === row.wallet_address.toLowerCase();
                const inZone = row.rank <= topN;
                const medal =
                  row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
                return (
                  <li
                    key={row.wallet_address}
                    className={cn(
                      "flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5 last:border-0",
                      isMe && "bg-delulu-blue-light/50",
                      inZone && !isMe && "bg-[#fffbeb]/60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex w-8 shrink-0 items-center justify-center text-sm font-black tabular-nums">
                        {medal ?? (
                          <span className={inZone ? "text-[#9a7b0a]" : "text-muted-foreground"}>
                            {row.rank}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {formatLeaderboardDisplayName({
                              username: row.username,
                              walletAddress: row.wallet_address,
                              isMe,
                              formatAddress,
                            })}
                          </span>
                          {row.is_community_member ? (
                            <span className="rounded-full bg-delulu-blue-light px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-delulu-blue">
                              Member
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
                      {row.points_total}
                      <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
                        pts
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {showClaimNote ? (
            <p className="mt-3 rounded-xl border border-[#f6c324]/40 bg-[#fffbeb] px-3.5 py-2.5 text-xs text-[#9a7b0a]">
              You&apos;re in the prize zone. Join{" "}
              <Link href={`/communities/${communitySlug}`} className="font-bold underline">
                {communityName}
              </Link>{" "}
              before claiming when payouts go live.
            </p>
          ) : null}
        </section>
      </main>


      <ProofModal
        open={proofOpen}
        onOpenChange={onProofOpenChange}
        onSubmit={onProofSubmit}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        onDone={onProofDone}
        proofInstructions={campaign.proof_instructions}
        isOnChain={campaign.on_chain_challenge_id != null}
        proofStep={proofStep}
      />
    </>
  );
}
