"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  Coins,
  Flame,
  Loader2,
  LogOut,
  Share2,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { formatUnits } from "viem";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CommunityCampaignMilestoneList } from "@/components/community/community-campaign-milestone-list";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { cn, formatAddress } from "@/lib/utils";
import { formatLeaderboardDisplayName } from "@/lib/community/enrich-leaderboard-usernames";
import { useUserStore } from "@/stores/useUserStore";
import {
  formatMilestoneOpensAt,
  getActiveMilestone,
  getUpcomingMilestone,
} from "@/lib/community/milestone-submit-eligibility";
import { isCampaignFunded, isCampaignEndedByDate } from "@/lib/community/campaign-types";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import { useClaimCommunityCampaignReward } from "@/hooks/use-community-campaign-onchain";

export type CommunityCampaignDetailData = {
  id: string;
  title: string;
  description: string | null;
  proof_instructions: string | null;
  proof_cadence: string;
  proof_type?: string;
  live_camera_duration_seconds?: number | null;
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

const LEADERBOARD_PAGE_SIZE = 20;

export type CampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
  username?: string | null;
  pfp_url?: string | null;
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
          ? "bg-black text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] hover:bg-black/90"
          : "bg-muted text-muted-foreground",
        size === "large" ? "px-7 py-4 text-base" : "px-6 py-3 text-base",
        className,
      )}
    >
      {joining ? (
        <span className="inline-flex items-center justify-center gap-2.5">
          <Loader2 className="h-5 w-5 animate-spin" />
          Joining…
        </span>
      ) : canJoin ? (
        "Join campaign"
      ) : (
        "Coming soon"
      )}
    </button>
  );
}


/** Scale hero title down as copy gets longer so it stays in the cover area. */
function campaignTitleClassName(title: string) {
  const len = title.trim().length;
  if (len > 90) {
    return "text-lg font-black leading-snug tracking-tight text-white sm:text-xl lg:text-base";
  }
  if (len > 60) {
    return "text-xl font-black leading-tight tracking-tight text-white sm:text-2xl lg:text-lg";
  }
  if (len > 36) {
    return "text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-xl";
  }
  return "text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-2xl";
}

/** Scale description so longer copy still reads cleanly without blowing the layout. */
function campaignDescriptionClassName(
  description: string,
  variant: "hero" | "body",
) {
  const len = description.trim().length;
  if (variant === "hero") {
    if (len > 160) {
      return "mt-2.5 line-clamp-3 text-xs leading-snug text-white/85";
    }
    if (len > 90) {
      return "mt-2.5 line-clamp-2 text-sm leading-relaxed text-white/85";
    }
    return "mt-2.5 line-clamp-2 text-base leading-relaxed text-white/85 lg:text-sm";
  }
  if (len > 220) {
    return "text-sm leading-relaxed text-muted-foreground border-b border-[#f6c324]/20 pb-4 lg:text-xs";
  }
  if (len > 120) {
    return "text-[15px] leading-relaxed text-muted-foreground border-b border-[#f6c324]/20 pb-4 lg:text-sm";
  }
  return "text-base leading-relaxed text-muted-foreground border-b border-[#f6c324]/20 pb-4 lg:text-sm";
}

export function CommunityCampaignDetail({
  campaign,
  communitySlug,
  leaderboard,
  leaderboardPage = 0,
  hasMoreLeaderboard = false,
  loadingLeaderboardPage = false,
  onPrevLeaderboardPage,
  onNextLeaderboardPage,
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
  onJoinCommunity,
  joiningCommunity = false,
  onLeave,
  leaving = false,
  onOpenProof,
  onProofOpenChange,
  onProofSubmit,
  onProofDone,
}: {
  campaign: CommunityCampaignDetailData;
  communitySlug: string;
  leaderboard: CampaignLeaderboardRow[];
  leaderboardPage?: number;
  hasMoreLeaderboard?: boolean;
  loadingLeaderboardPage?: boolean;
  onPrevLeaderboardPage?: () => void;
  onNextLeaderboardPage?: () => void;
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
  onJoinCommunity?: () => void;
  joiningCommunity?: boolean;
  onLeave?: () => void;
  leaving?: boolean;
  onOpenProof: (milestoneId: number) => void;
  onProofOpenChange: (open: boolean) => void;
  onProofSubmit: (proofUrls: string[]) => void;
  onProofDone: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [claimInfo, setClaimInfo] = useState<{
    eligible: boolean;
    alreadyClaimed?: boolean;
    amountWei?: string;
    proof?: `0x${string}`[];
    onChainChallengeId?: number;
    reason?: string;
  } | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const {
    claimCommunityCampaignRewardAndWait,
    errorMessage: claimTxError,
    reset: resetClaimTx,
  } = useClaimCommunityCampaignReward();

  const { user } = useUserStore();
  const myUsername = user?.username ?? null;
  const myAvatar = user?.pfpUrl ?? null;
  const campaignShareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/communities/${communitySlug}/campaigns/${campaign.id}`
      : null;
  const activeMilestoneIndex =
    activeMilestoneId != null
      ? milestones.findIndex((m) => m.milestone_id === activeMilestoneId)
      : null;

  useEffect(() => {
    if (!address || campaign.status !== "ended") {
      setClaimInfo(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/community/campaigns/${campaign.id}/claim?address=${encodeURIComponent(address)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setClaimInfo(json);
      } catch {
        if (!cancelled) setClaimInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, campaign.id, campaign.status, claimSuccess]);

  const handleClaimReward = useCallback(async () => {
    if (!address || !claimInfo?.eligible || !claimInfo.amountWei || !claimInfo.proof) return;
    if (claimInfo.onChainChallengeId == null) return;
    setClaimBusy(true);
    setClaimError(null);
    resetClaimTx();
    try {
      const txHash = await claimCommunityCampaignRewardAndWait({
        challengeId: claimInfo.onChainChallengeId,
        amountWei: BigInt(claimInfo.amountWei),
        proof: claimInfo.proof,
      });
      await fetch(`/api/community/campaigns/${campaign.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, txHash }),
      });
      setClaimSuccess(true);
    } catch (err) {
      setClaimError(
        claimTxError ||
          (err instanceof Error ? err.message : "Claim failed. Please try again."),
      );
    } finally {
      setClaimBusy(false);
    }
  }, [
    address,
    campaign.id,
    claimInfo,
    claimCommunityCampaignRewardAndWait,
    claimTxError,
    resetClaimTx,
  ]);

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
  const inPrizeZone =
    isPaidJoin && myLeaderboardRow ? myLeaderboardRow.rank <= topN : false;
  const showClaimNote = inPrizeZone && isJoined && !isCommunityMember && funded;
  const claimAmountLabel =
    claimInfo?.amountWei != null
      ? `${Number(formatUnits(BigInt(claimInfo.amountWei), 18)).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} G$`
      : null;
  const canClaimReward =
    campaign.status === "ended" &&
    !!claimInfo?.eligible &&
    !claimInfo.alreadyClaimed &&
    !claimSuccess;

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

  const isClosed =
    campaign.status === "ended" || isCampaignEndedByDate(campaign.display_ends_at);

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
      <main className="mx-auto max-w-2xl pb-28 lg:max-w-4xl">

        {/* ── Back nav + Hero ── */}
        <div className="relative px-5 pt-2.5 lg:px-3">
          <Link
            href={`/communities/${communitySlug}`}
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-semibold text-muted-foreground backdrop-blur-sm hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
              </div>
            ) : (
              <div
                className={cn(
                  "w-full bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]",
                  heroAspect,
                )}
              />
            )}

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                {showPrizePool ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f6c324]/50 bg-[#f6c324]/90 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#1a1a19]">
                    <Trophy className="h-3.5 w-3.5" />
                    {participantStakes > 0 && stakeToken !== "G$" && fundedPool > 0
                      ? `${fundedPool} G$ + ${participantStakes} ${stakeToken}`
                      : `${totalPrizePool} G$`}{" "}
                    pool
                  </span>
                ) : funded && campaign.proposed_pool_amount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f6c324]/50 bg-[#f6c324]/90 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#1a1a19]">
                    <Trophy className="h-3.5 w-3.5" />
                    {campaign.proposed_pool_amount} G$ pool
                  </span>
                ) : null}
              </div>
              <h1 className={campaignTitleClassName(campaign.title)}>
                {campaign.title}
              </h1>
              {/* Description only shown on hero for non-joined (evaluators need context) */}
              {!isJoined && campaign.description ? (
                <p className={campaignDescriptionClassName(campaign.description, "hero")}>
                  {campaign.description}
                </p>
              ) : null}
              {/* Hosted by — inside cover so it never wraps alongside action buttons */}
              <p className="mt-2.5 text-xs text-white/55">
                Hosted by{" "}
                <Link
                  href={`/communities/${communitySlug}`}
                  className="font-semibold text-white/80 hover:text-white"
                >
                  {communityName}
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            JOINED PATH — action-first layout
            ════════════════════════════════════════════ */}
        {isJoined ? (
          <>
            {/* Progress strip — instant context at the top */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5 px-5 lg:px-3">
              <span className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-bold tabular-nums text-foreground">
                {completedCount}/{milestoneCount} done
              </span>
              {myPoints > 0 ? (
                <span className="rounded-lg bg-delulu-blue-light px-3 py-2 text-sm font-bold tabular-nums text-delulu-blue">
                  {myPoints} pts earned
                </span>
              ) : null}
              {myRank ? (
                <span className="rounded-lg bg-muted px-3 py-2 text-sm font-bold text-foreground">
                  Rank #{myRank}
                </span>
              ) : null}
              <span className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-semibold text-muted-foreground">
                {daysLeft}d left
              </span>

              {/* Leave campaign */}
              {onLeave && !isClosed ? (
                leaveConfirm ? (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Leave campaign?</span>
                    <button
                      type="button"
                      disabled={leaving}
                      onClick={() => { onLeave(); setLeaveConfirm(false); }}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {leaving ? "Leaving…" : "Yes, leave"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveConfirm(false)}
                      className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLeaveConfirm(true)}
                    aria-label="Leave campaign"
                    title="Leave campaign"
                    className="ml-auto flex items-center justify-center rounded-lg p-2 text-muted-foreground/60 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )
              ) : null}
            </div>

            {actionError ? (
              <p className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive lg:mx-3">
                {actionError}
              </p>
            ) : null}

            {/* Status cards — milestones coming soon or all complete */}
            {milestones.length === 0 ? (
              <div className="mx-5 mt-4 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 lg:mx-3">
                <div className="border-l-4 border-muted-foreground/30 p-6">
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Milestones coming soon
                  </p>
                  <p className="mt-1.5 text-base text-muted-foreground">
                    An admin is adding milestones on-chain. Check back shortly.
                  </p>
                </div>
              </div>
            ) : !focusMilestone ? (
              <div className="mx-5 mt-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/8 lg:mx-3">
                <div className="border-l-4 border-emerald-500 p-6">
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                    All milestones complete 🎉
                  </p>
                  <p className="mt-1.5 text-base text-muted-foreground">
                    {isPaidJoin && myRank
                      ? `You're ranked #${myRank}`
                      : "All done — great work"}
                    {myPoints > 0 ? ` · ${myPoints} pts earned` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            {/* ── MILESTONES — front and centre ── */}
            <section className="mt-6 px-5 lg:px-3">
              <div className="rounded-3xl border border-delulu-blue/15 bg-delulu-blue-light/30 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    className="text-lg font-black text-foreground lg:text-base"
                  >
                    Milestones
                  </h2>
                  {milestoneCount > 0 ? (
                    <span className="text-sm font-semibold text-delulu-blue lg:text-xs">
                      {(completedCount * BASE_PROOF_POINTS).toLocaleString()} / {(milestoneCount * BASE_PROOF_POINTS).toLocaleString()} pts
                    </span>
                  ) : null}
                </div>
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
                    className="mt-4 flex w-full items-center justify-center rounded-xl border border-delulu-blue/20 bg-background/60 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {showAllMilestones
                      ? "Show less"
                      : `Show ${milestones.length - MILESTONES_PREVIEW} more milestone${milestones.length - MILESTONES_PREVIEW !== 1 ? "s" : ""}`}
                  </button>
                ) : null}
              </div>
            </section>

            {/* Rewards + proof info — always visible, single card */}
            <section className="mt-5 px-5 lg:px-3">
              <div className="rounded-2xl border border-[#f6c324]/25 bg-[#fffbeb]/50 p-6 space-y-5">
                {campaign.description ? (
                  <p className={campaignDescriptionClassName(campaign.description, "body")}>
                    {campaign.description}
                  </p>
                ) : null}

                {/* What you're playing for */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 text-foreground">
                      <Star className="h-4 w-4 text-delulu-blue" />
                      Complete a milestone
                    </span>
                    <span className="font-bold text-delulu-blue">+1,000 pts</span>
                  </div>
                  {isPaidJoin ? (
                    <div className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2 text-foreground">
                        <Trophy className="h-4 w-4 text-emerald-600" />
                        Rank in the top {topN}
                      </span>
                      <span className="font-bold text-emerald-700">
                        Split the forfeit pool{totalPrizePool > 0 ? ` · ${totalPrizePool} G$` : ""}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2 text-foreground">
                      <Target className="h-4 w-4 text-[#9a7b0a]" />
                      Stay consistent
                    </span>
                    <span className="font-bold text-[#9a7b0a]">Achieve your goal</span>
                  </div>
                </div>

                {/* Upload proof — merged into same card */}
                <div className="border-t border-[#f6c324]/20 pt-4 flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f6c324]/25 text-[#9a7b0a]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Upload proof</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {campaign.proof_instructions ??
                        "Complete each milestone and upload proof to earn your points."}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Points earned here count toward rewards on Delulu.
                </p>
              </div>

              {isPaidJoin && (campaign.forfeit_pct ?? 0) > 0 ? (
                <div className="mt-2.5 rounded-2xl border border-orange-200/70 bg-orange-50/60 p-5 flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">Miss your milestone</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Forfeit <strong className="text-orange-700">{campaign.forfeit_pct}% of your stake</strong> per missed milestone. Those amounts grow the forfeit pool for winners.
                    </p>
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
            {/* Action card — simplified for non-joined */}
            <div className="relative z-10 mx-5 mt-4 rounded-2xl border border-delulu-blue/20 bg-delulu-blue-light/40 p-6 shadow-lg lg:mx-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ready to compete?
                  </p>
                  <p className="mt-1.5 text-base text-muted-foreground">
                    {milestoneCount === 0
                      ? "Milestones coming soon"
                      : `${participantCount} joined · ${daysLeft}d left`}
                  </p>
                </div>
                {canJoin ? (
                  <JoinButton
                    joining={joining}
                    canJoin={canJoin}
                    onJoin={onJoin}
                    size="large"
                  />
                ) : (
                  <p className="text-base font-semibold text-muted-foreground">Not open yet</p>
                )}
              </div>
              {actionError ? (
                <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}
            </div>

            {/* ── Reward card — prize / top-N framing is paid-only ── */}
            {isPaidJoin || showPrizePool ? (
              <div className="mt-5 px-5 lg:px-3">
                {showPrizePool ? (() => {
                  const perWinner = topN > 0 ? Math.floor(totalPrizePool / topN) : 0;
                  return (
                    <div className="overflow-hidden rounded-2xl border border-[#f6c324]/35 bg-gradient-to-br from-[#fffbeb] via-[#fffcf0] to-white shadow-[0_2px_16px_rgba(246,195,36,0.12)]">
                      <div className="flex items-center gap-2.5 border-b border-[#f6c324]/20 px-5 py-3">
                        <Trophy className="h-5 w-5 text-[#9a7b0a]" />
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9a7b0a]">
                          Prize Pool
                        </p>
                      </div>

                      <div
                        className={cn(
                          "grid divide-x divide-[#f6c324]/20",
                          isPaidJoin ? "grid-cols-3" : "grid-cols-1",
                        )}
                      >
                        <div className="flex flex-col items-center px-4 py-5 text-center">
                          <p
                            className="text-2xl font-black tabular-nums text-foreground sm:text-3xl"
                            style={{ fontFamily: '"Clash Display", sans-serif' }}
                          >
                            {totalPrizePool.toLocaleString()}
                            <span className="ml-1.5 text-base font-bold text-[#9a7b0a]">G$</span>
                          </p>
                          <p className="mt-1.5 text-[11px] font-semibold text-[#9a7b0a]/70">Total pool</p>
                        </div>

                        {isPaidJoin ? (
                          <>
                            <div className="flex flex-col items-center px-4 py-5 text-center">
                              <p
                                className="text-2xl font-black tabular-nums text-foreground sm:text-3xl"
                                style={{ fontFamily: '"Clash Display", sans-serif' }}
                              >
                                {perWinner > 0 ? (
                                  <>
                                    ~{perWinner.toLocaleString()}
                                    <span className="ml-1.5 text-base font-bold text-[#9a7b0a]">G$</span>
                                  </>
                                ) : (
                                  "TBD"
                                )}
                              </p>
                              <p className="mt-1.5 text-[11px] font-semibold text-[#9a7b0a]/70">
                                Per winner
                              </p>
                            </div>

                            <div className="flex flex-col items-center px-4 py-5 text-center">
                              <p
                                className="text-2xl font-black tabular-nums text-foreground sm:text-3xl"
                                style={{ fontFamily: '"Clash Display", sans-serif' }}
                              >
                                Top {topN}
                              </p>
                              <p className="mt-1.5 text-[11px] font-semibold text-[#9a7b0a]/70">
                                Winners
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>

                      {isPaidJoin ? (
                        <div className="border-t border-[#f6c324]/20 px-5 py-3">
                          <p className="text-xs text-[#9a7b0a]/70">
                            Top {topN} on the leaderboard share the prize pool.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })() : (
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                    <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3">
                      <Star className="h-5 w-5 fill-[#f6c324] text-[#f6c324]" />
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/60">
                        Leaderboard Reward
                      </p>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/40">
                      <div className="flex flex-col items-center px-4 py-5 text-center">
                        <p
                          className="text-3xl font-black text-foreground"
                          style={{ fontFamily: '"Clash Display", sans-serif' }}
                        >
                          Top {topN}
                        </p>
                        <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">Winners</p>
                      </div>
                      <div className="flex flex-col items-center px-4 py-5 text-center">
                        <p
                          className="text-3xl font-black text-foreground"
                          style={{ fontFamily: '"Clash Display", sans-serif' }}
                        >
                          Points
                        </p>
                        <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">Ranked by</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Stakes & Rewards — cost & payout mechanics, styled to match the Prize Pool card */}
            {isPaidJoin && joinStakeAmount > 0 ? (
              <div className="mt-5 px-5 lg:px-3">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3">
                    <Coins className="h-5 w-5 text-muted-foreground" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground/60">
                      Stakes &amp; Rewards
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-border/40 sm:grid-cols-4">
                    <div className="flex flex-col items-center bg-card px-3 py-5 text-center">
                      <p
                        className="text-xl font-black tabular-nums text-foreground sm:text-2xl"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        {joinStakeAmount}
                        <span className="ml-1 text-xs font-bold text-muted-foreground">{stakeToken}</span>
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Your stake
                      </p>
                    </div>

                    {(campaign.forfeit_pct ?? 0) > 0 ? (
                      <div className="flex flex-col items-center bg-card px-3 py-5 text-center">
                        <p
                          className="text-xl font-black tabular-nums text-orange-600 sm:text-2xl"
                          style={{ fontFamily: '"Clash Display", sans-serif' }}
                        >
                          −{Math.round(joinStakeAmount * (campaign.forfeit_pct ?? 0) / 100)}
                          <span className="ml-1 text-xs font-bold text-orange-600/70">{stakeToken}</span>
                        </p>
                        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Miss a milestone ({campaign.forfeit_pct}%)
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-col items-center bg-card px-3 py-5 text-center">
                      <p
                        className="text-xl font-black text-emerald-700 sm:text-2xl"
                        style={{ fontFamily: '"Clash Display", sans-serif' }}
                      >
                        Top {topN}
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        If you win
                      </p>
                    </div>

                    {totalPrizePool > 0 ? (
                      <div className="flex flex-col items-center bg-card px-3 py-5 text-center">
                        <p
                          className="text-xl font-black tabular-nums text-[#9a7b0a] sm:text-2xl"
                          style={{ fontFamily: '"Clash Display", sans-serif' }}
                        >
                          {totalPrizePool}
                          <span className="ml-1 text-xs font-bold text-[#9a7b0a]/70">G$</span>
                        </p>
                        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Current pool
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-[#f6c324]/20 bg-orange-50/60 px-5 py-3">
                    <p className="text-xs leading-relaxed text-orange-700">
                      Forfeited stakes from missed milestones are added to the prize pool — winners earn more when others slip up.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Milestone preview — moved above "How it works" so it's the first thing people see */}
            <section className="mt-8 px-5 lg:px-3">
              <div className="rounded-3xl border border-delulu-blue/15 bg-delulu-blue-light/30 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2
                    className="text-lg font-black text-foreground lg:text-base"
                  >
                    Milestones
                  </h2>
                  {milestoneCount > 0 ? (
                    <span className="text-sm font-semibold text-delulu-blue lg:text-xs">
                      Earn up to {(milestoneCount * BASE_PROOF_POINTS).toLocaleString()} pts
                    </span>
                  ) : null}
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
                    className="mt-4 flex w-full items-center justify-center rounded-xl border border-delulu-blue/20 bg-background/60 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {showAllMilestones
                      ? "Show less"
                      : `Show ${milestones.length - MILESTONES_PREVIEW} more milestone${milestones.length - MILESTONES_PREVIEW !== 1 ? "s" : ""}`}
                  </button>
                ) : null}
              </div>
            </section>

            {/* How it works */}
            <section className="mt-8 px-5 lg:px-3">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                How it works
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {/* 1 — Earn points (lead with the win) */}
                <div className="rounded-2xl border border-delulu-blue/20 bg-delulu-blue-light/40 p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-delulu-blue-light text-delulu-blue">
                    <Star className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-foreground">Earn points</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Upload proof for each milestone and earn points. Points count toward rewards on Delulu.
                  </p>
                </div>
                {/* 2 — Achieve goal */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-foreground">Achieve your goal</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Stay consistent, build the habit, and actually accomplish what you set out to do.
                  </p>
                </div>
                {/* 3 — Win the forfeit pool (paid only; free campaigns have no ranking prizes) */}
                {isPaidJoin ? (
                  <div className="rounded-2xl border border-[#f6c324]/25 bg-[#fffbeb]/50 p-5">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f6c324]/25 text-[#9a7b0a]">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <p className="text-base font-bold text-foreground">Win the forfeit pool</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Top {topN} on the leaderboard split the forfeit pool when the campaign ends.
                    </p>
                  </div>
                ) : null}
                {/* 4 — Upload proof */}
                <div className="rounded-2xl border border-[#E9C0E9]/50 bg-[#E9C0E9]/15 p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#E9C0E9]/40 text-[#8a3f8a]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-foreground">Upload proof</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {campaign.proof_instructions ??
                      "Complete each milestone and upload proof to earn your points."}
                  </p>
                </div>
              </div>
            </section>

          </>
        )}

        {/* ── Invite / share actions — before leaderboard ── */}
        <div className="mt-8 flex items-center justify-center gap-4 px-5 lg:px-3">
          {campaign.telegram_link ? (
            <a
              href={campaign.telegram_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-5 py-2.5 text-sm font-semibold text-[#1a8cc7] hover:bg-[#2AABEE]/20 transition-colors"
            >
              Join Telegram
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void handleInvite()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Share2 className="h-4 w-4" />
            {inviteCopied ? "Link copied!" : "Invite friends"}
          </button>
        </div>

        {/* ── Leaderboard (paid campaigns only — free has no ranking / top-N prizes) ── */}
        {isPaidJoin ? (
        <section ref={leaderboardRef} className="mt-10 px-5 lg:px-3">
          <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/6 p-5">
          <div className="mb-4 flex items-center justify-between gap-2.5">
            <div>
              <h2
                className="flex items-center gap-2.5 text-lg font-black text-foreground lg:text-base"
              >
                <Trophy className="h-5 w-5 text-delulu-blue" />
                Leaderboard
              </h2>
              <p className="text-sm text-muted-foreground">
                {participantCount} participant{participantCount !== 1 ? "s" : ""} · top {topN} win
              </p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-card px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-delulu-blue-light text-delulu-blue">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-base font-bold text-foreground">No one on the board yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Be the first to join and claim the top spot.
              </p>
              {!isJoined && canJoin ? (
                <div className="mt-5 flex justify-center">
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
                      "flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-0",
                      isMe && "bg-delulu-blue-light/50",
                      inZone && !isMe && "bg-[#fffbeb]/60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex w-9 shrink-0 items-center justify-center text-base font-black tabular-nums">
                        {medal ?? (
                          <span className={inZone ? "text-[#9a7b0a]" : "text-muted-foreground"}>
                            {row.rank}
                          </span>
                        )}
                      </span>
                      <UserAvatar
                        address={row.wallet_address}
                        username={row.username}
                        pfpUrl={row.pfp_url ?? null}
                        size={32}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-base font-semibold lg:text-sm">
                            {formatLeaderboardDisplayName({
                              username: row.username,
                              walletAddress: row.wallet_address,
                              isMe,
                              formatAddress,
                            })}
                          </span>
                          {row.is_community_member ? (
                            <span className="rounded-full bg-delulu-blue-light px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-delulu-blue">
                              Member
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-base font-black tabular-nums text-foreground lg:text-sm">
                      {row.points_total}
                      <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                        pts
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {leaderboard.length > 0 ? (
            <LeaderboardPagination
              page={leaderboardPage}
              rangeStart={leaderboardPage * LEADERBOARD_PAGE_SIZE + 1}
              rangeEnd={leaderboardPage * LEADERBOARD_PAGE_SIZE + leaderboard.length}
              hasNextPage={hasMoreLeaderboard}
              onPrev={() => onPrevLeaderboardPage?.()}
              onNext={() => onNextLeaderboardPage?.()}
            />
          ) : null}
          {loadingLeaderboardPage ? (
            <p className="mt-2.5 text-center text-sm text-muted-foreground">Loading…</p>
          ) : null}
          </div>

          {canClaimReward ? (
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">
                You&apos;re a winner{claimAmountLabel ? ` — claim ${claimAmountLabel}` : ""}.
              </p>
              <button
                type="button"
                onClick={() => void handleClaimReward()}
                disabled={claimBusy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-delulu-charcoal py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {claimBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {claimBusy ? "Claiming…" : "Claim reward"}
              </button>
              {claimError ? (
                <p className="text-xs text-destructive">{claimError}</p>
              ) : null}
            </div>
          ) : null}

          {claimSuccess || claimInfo?.alreadyClaimed ? (
            <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-800">
              Reward claimed{claimAmountLabel ? ` (${claimAmountLabel})` : ""}.
            </p>
          ) : null}

          {showClaimNote && !canClaimReward && !claimSuccess ? (
            <p className="mt-4 rounded-xl border border-[#f6c324]/40 bg-[#fffbeb] px-4 py-3 text-sm text-[#9a7b0a]">
              You&apos;re in the prize zone. Join{" "}
              <Link href={`/communities/${communitySlug}`} className="font-bold underline">
                {communityName}
              </Link>{" "}
              so you can claim when this campaign ends.
            </p>
          ) : null}

          {campaign.status === "ended" &&
          inPrizeZone &&
          claimInfo &&
          !claimInfo.eligible &&
          !claimInfo.alreadyClaimed &&
          !claimSuccess ? (
            <p className="mt-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {claimInfo.reason ?? "Payouts are not available yet."}
            </p>
          ) : null}
        </section>
        ) : null}
      </main>


      <SubmitProofModal
        open={proofOpen}
        onOpenChange={onProofOpenChange}
        onSubmit={onProofSubmit}
        proofType={campaign.proof_type}
        liveCameraDurationSeconds={campaign.live_camera_duration_seconds}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        onDone={onProofDone}
        proofInstructions={campaign.proof_instructions}
        isOnChain={campaign.on_chain_challenge_id != null}
        proofStep={proofStep}
        milestoneName={activeMilestone?.label ?? null}
        milestoneDeadline={activeMilestone?.deadline ?? null}
        campaignTitle={campaign.title}
        communityName={campaign.communities?.name ?? null}
        myUsername={myUsername}
        myAvatar={myAvatar}
        myStreak={myStreak}
        myPoints={myPoints}
        milestoneIndex={activeMilestoneIndex ?? undefined}
        milestoneCount={milestoneCount}
        shareUrl={campaignShareUrl}
      />
    </>
  );
}
