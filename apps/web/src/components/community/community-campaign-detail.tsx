"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Check, ChevronLeft, Loader2, Plus, Share } from "lucide-react";
import { gameButtonClass } from "@/components/ds";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
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
  getActiveMilestone,
} from "@/lib/community/milestone-submit-eligibility";
import {
  isCampaignExpired,
  getEffectiveDisplayEndsAt,
} from "@/lib/community/campaign-types";
import { pointsPerMilestoneForJoinAmount } from "@/lib/dashboard/campaign-constants";
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
  created_at?: string | null;
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

function daysRemaining(effectiveEndsAt: string | null, durationDays: number) {
  if (!effectiveEndsAt) return durationDays;
  return Math.max(0, Math.ceil((new Date(effectiveEndsAt).getTime() - Date.now()) / 86400000));
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
  isCommunityMember: _isCommunityMember,
  address,
  authenticated: _authenticated,
  joining,
  myPoints,
  myStreak = 0,
  myRank: _myRank,
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
  onJoinCommunity: _onJoinCommunity,
  joiningCommunity: _joiningCommunity = false,
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
  const effectiveEndsAt = getEffectiveDisplayEndsAt({
    display_ends_at: campaign.display_ends_at,
    created_at: campaign.created_at,
    duration_days: campaign.duration_days,
  });
  const daysLeft = daysRemaining(effectiveEndsAt, campaign.duration_days ?? 30);
  const topN = campaign.prize_winner_count ?? 10;
  const communityName = campaign.communities?.name ?? "Community";
  const fundedPool = poolStats?.fundedPoolAmount ?? 0;
  const stakeToken = poolStats?.joinTokenLabel ?? campaign.join_token ?? "G$";
  // Claimable prize = funded G$ on-chain only. Never treat proposed_pool as claimable.
  const claimablePrize =
    poolStats?.totalPrizePoolAmount ?? fundedPool;
  const showPrizePool = claimablePrize > 0;
  const proposedPrize =
    !showPrizePool && campaign.proposed_pool_amount > 0
      ? campaign.proposed_pool_amount
      : 0;
  const isPaidJoin =
    poolStats?.isPaidOnChain ??
    (campaign.is_free_to_join === false && Number(campaign.join_amount ?? 0) > 0);
  const joinStakeAmount =
    poolStats?.joinAmountOnChain ?? Number(campaign.join_amount ?? 0);
  const pointsPerMilestone = pointsPerMilestoneForJoinAmount(
    isPaidJoin ? joinStakeAmount : 0,
  );

  const myLeaderboardRow = address
    ? leaderboard.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase())
    : undefined;
  const inPrizeZone =
    showPrizePool && myLeaderboardRow ? myLeaderboardRow.rank <= topN : false;
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

  const isClosed = campaign.status === "ended" || isCampaignExpired(campaign);

  const [showAllStandings, setShowAllStandings] = useState(false);
  const proofDone = activeMilestone?.completed ?? false;
  const cadence = (campaign.proof_cadence || "daily").toLowerCase();
  const rules = [
    campaign.proof_instructions?.trim() || `Prove it ${cadence}`,
    `Each verified proof earns ${pointsPerMilestone.toLocaleString()} points`,
    showPrizePool
      ? `Top ${topN} split the pool by points at the end`
      : isPaidJoin && joinStakeAmount > 0
        ? `Stake ${joinStakeAmount.toLocaleString()} ${stakeToken} to join · reclaim it after`
        : "Points rank you on the standings",
    ...(isPaidJoin && (campaign.forfeit_pct ?? 0) > 0
      ? [`Miss a milestone, lose ${campaign.forfeit_pct}% of your stake`]
      : []),
  ];
  const poolValue = showPrizePool ? claimablePrize : proposedPrize;
  const compact = (n: number) =>
    n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n);
  const standings = showAllStandings
    ? leaderboard
    : [
        ...leaderboard.slice(0, 3),
        ...(myLeaderboardRow && myLeaderboardRow.rank > 3 ? [myLeaderboardRow] : []),
      ];

  const handleShare = async () => {
    if (campaignShareUrl && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: campaign.title, url: campaignShareUrl });
        return;
      } catch {
        /* cancelled — fall back to copying */
      }
    }
    await handleInvite();
  };

  const cta = canClaimReward ? (
    <button
      type="button"
      onClick={() => void handleClaimReward()}
      disabled={claimBusy}
      className={gameButtonClass({ variant: "green", full: true })}
    >
      {claimBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {claimBusy ? "Claiming…" : `Claim ${claimAmountLabel ?? "reward"}`}
    </button>
  ) : !isJoined && canJoin && !isClosed ? (
    <button
      type="button"
      onClick={onJoin}
      disabled={joining}
      className="press-edge flex h-14 w-full items-center justify-between rounded-2xl bg-ink pl-6 pr-1.5 text-base font-bold text-white shadow-edge-ink disabled:opacity-60"
    >
      {joining
        ? "Joining…"
        : isPaidJoin && joinStakeAmount > 0
          ? `Join · stake ${joinStakeAmount.toLocaleString()} ${stakeToken}`
          : "Join campaign"}
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow text-ink">
        {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2.4} />}
      </span>
    </button>
  ) : isJoined && !isClosed && activeMilestone && !proofDone ? (
    <button
      type="button"
      onClick={() => onOpenProof(activeMilestone.milestone_id)}
      disabled={proofBusy}
      className={gameButtonClass({ full: true })}
    >
      {proofBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" strokeWidth={2} />}
      Prove today
    </button>
  ) : null;

  const stats = [
    ...(poolValue > 0 ? [{ value: compact(poolValue), label: "G$ pool" }] : []),
    { value: String(participantCount), label: "In" },
    { value: isClosed ? "End" : `${daysLeft}D`, label: isClosed ? "Status" : "Left" },
  ];

  return (
    <>
      <main className={cn("mx-auto max-w-xl", cta ? "pb-32" : "pb-10")}>
        {/* Header (design: CampaignDetail.dc.html) */}
        <div className="bg-[#fdf1c7] px-5 pb-12 pt-4">
          <div className="flex justify-between">
            <Link href="/explore" aria-label="Back" className={ICON_BUTTON_CLASS}>
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </Link>
            <button type="button" onClick={() => void handleShare()} aria-label="Share" className={ICON_BUTTON_CLASS}>
              {inviteCopied ? <Check className="h-5 w-5 text-green-edge" strokeWidth={2.4} /> : <Share className="h-5 w-5" strokeWidth={2} />}
            </button>
          </div>
          {campaign.cover_image_url ? (
            <div className="relative mt-4 aspect-[16/9] w-full animate-rise overflow-hidden rounded-3xl border-2 border-white bg-white/60 shadow-edge-sm">
              <Image src={campaign.cover_image_url} alt="" fill sizes="(max-width: 640px) 100vw, 576px" className={cn("object-cover", isClosed && "grayscale")} unoptimized priority />
            </div>
          ) : null}
          <span className="label-mono mt-6 block text-[#8a6a00]">{communityName} campaign</span>
          <h1 className="m-0 mt-1 animate-rise text-2xl font-bold leading-[1.2] tracking-[-0.02em]">{campaign.title}</h1>
        </div>

        {/* Stats ticket */}
        <div className="relative -mt-7 px-5">
          <div className="relative flex animate-rise rounded-3xl border-2 border-line bg-white shadow-[0_0_0_1px_#e6e6e0]">
            {stats.map((stat, i) => (
              <div key={stat.label} className={cn("flex-1 p-4 text-center", i > 0 && "border-l-2 border-dashed border-line")}>
                <div className="font-display text-[30px] font-extrabold uppercase leading-[0.88]">{stat.value}</div>
                <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
            {stats.slice(1).map((_, i) => `${((i + 1) * 100) / stats.length}%`).map((left) => (
              <span key={left}>
                <span className="absolute -top-2.5 h-5 w-5 -translate-x-1/2 rounded-full bg-paper" style={{ left }} />
                <span className="absolute -bottom-2.5 h-5 w-5 -translate-x-1/2 rounded-full bg-paper" style={{ left }} />
              </span>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="flex flex-col gap-2.5 px-5 pt-6">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-baseline gap-3.5">
              <span className="font-display text-[22px] font-extrabold uppercase leading-[0.88] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="line-clamp-2">{rule}</span>
            </div>
          ))}
        </div>

        {actionError ? (
          <p className="mx-5 mt-4 rounded-2xl bg-orange-soft px-4 py-2.5 text-sm font-semibold text-orange">{actionError}</p>
        ) : null}

        {/* Your milestones (joined) */}
        {isJoined && milestones.length > 0 ? (
          <section className="px-5 pt-6">
            <div className="mb-1.5 flex justify-between">
              <span className="label-mono text-muted-foreground">Your milestones</span>
              <span className="label-mono text-ink">
                {completedCount} / {milestoneCount}
              </span>
            </div>
            <CommunityCampaignMilestoneList
              milestones={showAllMilestones ? milestones : milestones.slice(0, MILESTONES_PREVIEW)}
              isJoined={isJoined}
              proofBusy={proofBusy}
              activeMilestoneId={activeMilestoneId}
              onSubmitMilestone={onOpenProof}
              pointsPerMilestone={pointsPerMilestone}
            />
            {milestones.length > MILESTONES_PREVIEW ? (
              <button
                type="button"
                onClick={() => setShowAllMilestones((v) => !v)}
                className="label-mono mt-2 text-ink"
              >
                {showAllMilestones ? "Show less" : `All ${milestones.length} →`}
              </button>
            ) : null}
          </section>
        ) : null}

        {/* Standings */}
        <section ref={leaderboardRef} className="px-5 pt-6">
          <div className="mb-1.5 flex justify-between">
            <span className="label-mono text-muted-foreground">Standings</span>
            {leaderboard.length > 3 ? (
              <button type="button" onClick={() => setShowAllStandings((v) => !v)} className="label-mono text-ink">
                {showAllStandings ? "Top ↑" : "All →"}
              </button>
            ) : null}
          </div>
          {leaderboard.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No one on the board yet. Be the first.</p>
          ) : (
            standings.map((row) => {
              const isMe = address?.toLowerCase() === row.wallet_address.toLowerCase();
              return (
                <div
                  key={row.wallet_address}
                  className={cn(
                    "flex animate-rise items-center gap-3 rounded-2xl px-3 py-2.5",
                    isMe && "bg-ink text-white",
                  )}
                >
                  <span className="w-[26px] font-display text-[26px] font-extrabold uppercase leading-[0.88]">{row.rank}</span>
                  <UserAvatar address={row.wallet_address} username={row.username} pfpUrl={row.pfp_url ?? null} size={36} />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {isMe
                      ? "You"
                      : formatLeaderboardDisplayName({ username: row.username, walletAddress: row.wallet_address, isMe, formatAddress })}
                  </span>
                  <span className="label-mono text-xs tracking-[0.06em]">{row.points_total.toLocaleString()}</span>
                </div>
              );
            })
          )}
          {showAllStandings && leaderboard.length > 0 ? (
            <LeaderboardPagination
              page={leaderboardPage}
              rangeStart={leaderboardPage * LEADERBOARD_PAGE_SIZE + 1}
              rangeEnd={leaderboardPage * LEADERBOARD_PAGE_SIZE + leaderboard.length}
              hasNextPage={hasMoreLeaderboard}
              onPrev={() => onPrevLeaderboardPage?.()}
              onNext={() => onNextLeaderboardPage?.()}
            />
          ) : null}
          {loadingLeaderboardPage ? <p className="mt-2.5 text-center text-sm text-muted-foreground">Loading…</p> : null}

          {claimError ? <p className="mt-3 text-xs font-semibold text-orange">{claimError}</p> : null}
          {claimSuccess || claimInfo?.alreadyClaimed ? (
            <p className="mt-4 rounded-2xl border-2 border-green-line bg-[#f2fbf5] px-4 py-3 text-sm font-bold text-green-edge">
              Reward claimed{claimAmountLabel ? ` (${claimAmountLabel})` : ""}.
            </p>
          ) : null}
          {campaign.status === "ended" && inPrizeZone && claimInfo && !claimInfo.eligible && !claimInfo.alreadyClaimed && !claimSuccess ? (
            <p className="mt-4 rounded-2xl border-2 border-line bg-white px-4 py-3 text-sm text-muted-foreground">
              {claimInfo.reason ?? "Payouts are not available yet."}
            </p>
          ) : null}
        </section>

        {/* Extras: Telegram + leave */}
        {campaign.telegram_link || (isJoined && onLeave && !isClosed && !isPaidJoin) ? (
          <div className="flex items-center justify-center gap-5 px-5 pt-8 text-sm font-semibold">
            {campaign.telegram_link ? (
              <a href={campaign.telegram_link} target="_blank" rel="noopener noreferrer" className="text-blue no-underline">
                Join Telegram
              </a>
            ) : null}
            {isJoined && onLeave && !isClosed && !isPaidJoin ? (
              leaveConfirm ? (
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={leaving}
                    onClick={() => {
                      onLeave();
                      setLeaveConfirm(false);
                    }}
                    className="text-orange disabled:opacity-50"
                  >
                    {leaving ? "Leaving…" : "Yes, leave"}
                  </button>
                  <button type="button" onClick={() => setLeaveConfirm(false)} className="text-muted-foreground">
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setLeaveConfirm(true)} className="text-muted-foreground">
                  Leave campaign
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </main>

      {cta ? (
        <div className="fixed inset-x-0 z-40 mx-auto max-w-xl px-5 lg:left-24" style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}>
          {cta}
        </div>
      ) : null}

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
        pointsAwarded={pointsPerMilestone}
        milestoneIndex={activeMilestoneIndex ?? undefined}
        milestoneCount={milestoneCount}
        shareUrl={campaignShareUrl}
      />
    </>
  );
}
