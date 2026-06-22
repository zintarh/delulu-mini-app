"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  ChevronLeft,
  Clock,
  Flame,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { ProofModal } from "@/components/proof-modal";
import { CommunityCampaignMilestoneList } from "@/components/community/community-campaign-milestone-list";
import { CampaignJoinModal } from "@/components/community/campaign-join-modal";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { cn, formatAddress } from "@/lib/utils";
import { isCampaignFunded } from "@/lib/community/campaign-types";

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

export type CampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
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

function JoinButton({
  joining,
  milestoneCount,
  onJoin,
  className,
  size = "default",
}: {
  joining: boolean;
  milestoneCount: number;
  onJoin: () => void;
  className?: string;
  size?: "default" | "large";
}) {
  const canJoin = milestoneCount > 0;
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
        "Milestones coming soon"
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
  milestones = [],
  proofOpen,
  proofBusy,
  proofSuccess,
  proofError,
  proofStep = "idle",
  activeMilestoneId,
  actionError,
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
  milestones?: CommunityCampaignMilestoneRow[];
  proofOpen: boolean;
  proofBusy: boolean;
  proofSuccess: boolean;
  proofError: string | null;
  proofStep?: ProofStep;
  activeMilestoneId?: number | null;
  actionError: string | null;
  onJoin: () => void;
  onOpenProof: (milestoneId: number) => void;
  onProofOpenChange: (open: boolean) => void;
  onProofSubmit: (imageUrl: string) => void;
  onProofDone: () => void;
}) {
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const funded = isCampaignFunded(campaign.status);
  const endsLabel = formatEndsAt(campaign.display_ends_at);
  const daysLeft = daysRemaining(campaign.display_ends_at, campaign.duration_days ?? 30);
  const topN = campaign.prize_winner_count ?? 10;
  const communityName = campaign.communities?.name ?? "Community";
  const isFreeToJoin = campaign.is_free_to_join !== false;

  const myLeaderboardRow = address
    ? leaderboard.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase())
    : undefined;
  const inPrizeZone = myLeaderboardRow ? myLeaderboardRow.rank <= topN : false;
  const showClaimNote = inPrizeZone && isJoined && !isCommunityMember && funded;

  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPct =
    milestoneCount > 0 ? Math.round((completedCount / milestoneCount) * 100) : 0;

  const nextMilestone = useMemo(
    () => milestones.find((m) => !m.completed) ?? null,
    [milestones],
  );

  const campaignPhase = useMemo(() => {
    if (milestoneCount === 0) return "setup" as const;
    if (isJoined) return "active" as const;
    return "open" as const;
  }, [milestoneCount, isJoined]);

  const phaseLabel = {
    setup: "Setting up",
    open: "Open to join",
    active: "You're in",
  }[campaignPhase];

  const phaseClass = {
    setup: "bg-[#fffbeb] text-[#9a7b0a] border-[#f6c324]/40",
    open: "bg-delulu-blue-light text-delulu-blue border-delulu-blue/30",
    active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  }[campaignPhase];

  function renderPrimaryCta(className?: string) {
    if (!authenticated) {
      return (
        <Link
          href="/sign-in"
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-delulu-blue px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-delulu-blue/90",
            className,
          )}
        >
          Sign in to join
        </Link>
      );
    }
    if (isJoined && nextMilestone) {
      return (
        <button
          type="button"
          disabled={proofBusy}
          onClick={() => onOpenProof(nextMilestone.milestone_id)}
          className={cn(
            "rounded-xl bg-delulu-blue px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-delulu-blue/90 disabled:opacity-50",
            className,
          )}
        >
          {proofBusy ? "Submitting…" : "Submit next proof"}
        </button>
      );
    }
    if (isJoined) {
      return (
        <div className={cn("text-center text-sm", className)}>
          <p className="font-bold text-foreground">
            {myRank ? `Rank #${myRank}` : "All milestones complete"}
          </p>
          {myPoints > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{myPoints} points earned</p>
          ) : null}
        </div>
      );
    }
    return (
      <JoinButton
        joining={joining}
        milestoneCount={milestoneCount}
        onJoin={() => setJoinModalOpen(true)}
        size="large"
        className={className}
      />
    );
  }

  return (
    <>
      <main className="mx-auto max-w-2xl pb-24">
        {/* Hero */}
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
              <div className="relative aspect-[16/9] w-full sm:aspect-[2/1]">
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
              <div className="aspect-[16/9] w-full bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a] sm:aspect-[2/1]" />
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
                {funded && campaign.proposed_pool_amount > 0 ? (
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
              {campaign.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/85">
                  {campaign.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Hosted by */}
        <div className="mt-4 px-4">
          <p className="text-[11px] text-muted-foreground">
            Hosted by{" "}
            <Link
              href={`/communities/${communitySlug}`}
              className="font-semibold text-foreground hover:underline"
            >
              {communityName}
            </Link>
          </p>
        </div>

        {/* Action card */}
        <div className="relative z-10 mx-4 mt-3 rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isJoined ? "Your progress" : "Ready to compete?"}
              </p>
              {isJoined && milestoneCount > 0 ? (
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="relative h-10 w-10">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${progressPct} 100`}
                        strokeLinecap="round"
                        className="text-delulu-blue"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-delulu-blue">
                      {progressPct}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {completedCount}/{milestoneCount} milestones
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {daysLeft}d left · {participantCount} joined
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {milestoneCount === 0
                    ? "Host is adding milestones"
                    : `${participantCount} participant${participantCount !== 1 ? "s" : ""} · ${daysLeft}d left`}
                </p>
              )}
            </div>
            <div>{renderPrimaryCta()}</div>
          </div>

          {isJoined && (myStreak > 0 || myPoints > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
              {myStreak > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">
                  <Flame className="h-3.5 w-3.5" />
                  {myStreak} streak
                </span>
              ) : null}
              {myPoints > 0 ? (
                <span className="rounded-lg bg-delulu-blue-light px-2.5 py-1 text-xs font-bold tabular-nums text-delulu-blue">
                  {myPoints} pts
                </span>
              ) : null}
              {myRank ? (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
                  Rank #{myRank}
                </span>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {actionError}
            </p>
          ) : null}
        </div>

        {/* Stats strip */}
        <div className="mt-4 overflow-x-auto px-4 scrollbar-hide">
          <div className="flex gap-2 pb-1">
            {funded && campaign.proposed_pool_amount > 0 ? (
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
              value={milestoneCount > 0 ? `${completedCount}/${milestoneCount}` : "Soon"}
            />
            <StatPill icon={Clock} label="Time left" value={`${daysLeft}d`} />
            <StatPill icon={Calendar} label="Ends" value={endsLabel ?? `${campaign.duration_days}d`} />
            <StatPill icon={Users} label="Winners" value={`Top ${topN}`} />
          </div>
        </div>

        {/* How it works — moved up, visual cards */}
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

        {/* Milestones */}
        <section className="mt-6 px-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-foreground" style={{ fontFamily: '"Clash Display", sans-serif' }}>
                Milestones
              </h2>
              <p className="text-xs text-muted-foreground">
                {milestoneCount > 0
                  ? "Complete each checkpoint before its deadline"
                  : "Checkpoints will appear here"}
              </p>
            </div>
          </div>
          <CommunityCampaignMilestoneList
            milestones={milestones}
            isJoined={isJoined}
            proofBusy={proofBusy}
            activeMilestoneId={activeMilestoneId}
            onSubmitMilestone={onOpenProof}
          />
        </section>

        {/* Leaderboard */}
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
              {!isJoined && authenticated && milestoneCount > 0 ? (
                <div className="mt-4 flex justify-center">
                  <JoinButton joining={joining} milestoneCount={milestoneCount} onJoin={onJoin} />
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
                            {isMe ? "You" : formatAddress(row.wallet_address)}
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
                      <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">pts</span>
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
        isOnChain={Boolean(campaign.on_chain_challenge_id)}
        proofStep={proofStep}
      />

      <CampaignJoinModal
        open={joinModalOpen}
        joining={joining}
        info={{
          title: campaign.title,
          communityName,
          milestoneCount,
          durationDays: campaign.duration_days,
          isFreeToJoin,
          joinToken: campaign.join_token ?? "G$",
          joinAmount: campaign.join_amount ?? 0,
          forfeitPct: campaign.forfeit_pct ?? 0,
          proposedPoolAmount: campaign.proposed_pool_amount,
          prizeWinnerCount: campaign.prize_winner_count,
          isFunded: funded,
        }}
        onConfirm={() => {
          setJoinModalOpen(false);
          onJoin();
        }}
        onCancel={() => setJoinModalOpen(false)}
      />
    </>
  );
}
