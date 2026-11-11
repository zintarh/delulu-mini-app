"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import { MissionCard, MissionCardSkeleton } from "@/components/community/mission-card";
import { FEED_CARD_EYEBROW_CLASS } from "@/components/feed-card-layout";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
} from "@/hooks/use-user-campaign-milestones";
import { submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import { proofErrorMessage } from "@/lib/community/format-proof-error";
import { useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { useUserStore } from "@/stores/useUserStore";
import { getActiveMilestone, getUpcomingMilestone } from "@/lib/community/milestone-submit-eligibility";
import { GameButton, ProgressBar, SectionHeading, Trophy as TrophyArt } from "@/components/ds";
import type { JoinedDashboardCampaign } from "@/hooks/use-user-campaign-milestones";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { pointsPerMilestoneForJoinAmount } from "@/lib/dashboard/campaign-constants";
import { forfeitProgress, formatStake, getForfeitTerms } from "@/lib/community/campaign-forfeit";
import { Check, Clock } from "lucide-react";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { useImageAccent } from "@/hooks/use-image-accent";
import { useRewardsSummary } from "@/hooks/use-rewards-summary";
import { progressUnit } from "@/lib/rewards/summary";

/** Stake line for a joined paid campaign: what's been lost, or what today's miss would cost. */
export function campaignStakeLine(c: JoinedDashboardCampaign, due: boolean): { text: string; warn: boolean } | null {
  const terms = getForfeitTerms({
    isFreeToJoin: c.is_free_to_join,
    joinAmount: c.join_amount,
    forfeitPct: c.forfeit_pct,
    joinToken: c.join_token,
    milestoneCount: c.milestone_count,
  });
  if (!terms) return null;
  const { lost, left } = forfeitProgress(terms, c.missed_count ?? 0);
  if (lost > 0) return { text: `−${formatStake(lost)} ${terms.token} lost · ${formatStake(left)} left`, warn: true };
  if (due) return { text: `Prove or lose ${formatStake(terms.perMiss)} ${terms.token}`, warn: true };
  return { text: `${formatStake(terms.stake)} ${terms.token} staked`, warn: false };
}

type QuestState = "due" | "upcoming" | "done" | "idle";

function questStateFor(c: JoinedDashboardCampaign, nowMs: number): {
  state: QuestState;
  milestone: CommunityCampaignMilestoneRow | null;
} {
  const active = getActiveMilestone(c.next_milestones, nowMs);
  if (active) return { state: "due", milestone: active };
  const upcoming = getUpcomingMilestone(c.next_milestones, nowMs);
  if (upcoming) return { state: "upcoming", milestone: upcoming };
  if (c.milestone_count > 0 && c.completed_count >= c.milestone_count) return { state: "done", milestone: null };
  return { state: "idle", milestone: null };
}

const QUEST_ORDER: Record<QuestState, number> = { due: 0, upcoming: 1, idle: 2, done: 3 };

/** "6:00 PM" today, "tomorrow 6:00 PM", otherwise "Tue 6:00 PM". */
function formatDeadline(iso: string, nowMs: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date(nowMs);
  if (today.toDateString() === d.toDateString()) return time;
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (tomorrow.toDateString() === d.toDateString()) return `tomorrow ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

export type CampaignFinishBonus = {
  /** What finishing pays from here (already reduced for a late join), or what was granted. */
  amount: number;
  reduced: boolean;
  state: "on_track" | "completed" | "rewarded";
};

/**
 * A joined campaign on Home: photo header with today's status and progress,
 * then what's at stake, the G$ for finishing (from the Rewards Engine), and
 * a big Prove button when a proof is due.
 */
export function CampaignQuestRow({
  campaign: c,
  nowMs,
  proofBusy,
  onProve,
  bonus,
  className,
}: {
  campaign: JoinedDashboardCampaign;
  nowMs: number;
  proofBusy: boolean;
  onProve: (_milestone: CommunityCampaignMilestoneRow) => void;
  bonus?: CampaignFinishBonus | null;
  className?: string;
}) {
  const { state, milestone } = questStateFor(c, nowMs);
  const due = state === "due" && !!milestone;
  const stakeLine = campaignStakeLine(c, due);
  const total = c.milestone_count;
  const done = Math.min(c.completed_count, total);
  const unit = progressUnit(c.duration_days, total);
  const accent = useImageAccent(c.cover_image_url);
  const avatars = c.participant_avatars ?? [];
  const others = Math.max(0, c.participant_count - 1);

  const chip =
    due && milestone
      ? { text: `Due ${formatDeadline(milestone.deadline, nowMs)}`, icon: <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />, cls: "bg-yellow text-ink" }
      : state === "upcoming" && milestone
        ? { text: `Next ${formatDeadline(milestone.start_time, nowMs)}`, icon: <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />, cls: "bg-white text-ink" }
        : state === "done"
          ? { text: "All proofs in", icon: <Check className="h-3.5 w-3.5" strokeWidth={3} />, cls: "bg-green text-white" }
          : { text: "No proof due", icon: null, cls: "bg-white/90 text-ink" };

  return (
    <div
      className={cn(
        "group relative flex min-w-0 animate-rise flex-col overflow-hidden rounded-[28px] border-2 bg-white transition-transform active:scale-[0.99]",
        due ? "border-yellow-line shadow-edge-yellow-line" : "border-line shadow-edge",
        className,
      )}
    >
      {/* Photo header */}
      <div
        className={cn("relative h-36 overflow-hidden", c.cover_image_url ? "bg-ink" : "bg-gradient-to-br from-ink-3 via-ink-2 to-ink")}
        style={!c.cover_image_url && accent ? { backgroundColor: accent.bg } : undefined}
      >
        {c.cover_image_url ? (
          <Image
            src={c.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 400px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <span className="absolute -right-3 -top-3 rotate-[10deg] opacity-90" aria-hidden>
            <TrophyArt size={120} />
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" aria-hidden />

        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {c.community.name}
          </span>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold", chip.cls)}>
            {chip.icon}
            {chip.text}
          </span>
        </div>

        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          {total > 0 ? (
            <div className="leading-none text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]">
              <span className="font-display text-[34px] font-extrabold tabular-nums">{done}</span>
              <span className="font-display text-lg font-extrabold text-white/70">/{total}</span>
              <span className="label-mono ml-1.5 text-[10px] text-white/80">{unit}</span>
            </div>
          ) : (
            <span />
          )}
          {avatars.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <AvatarStack participants={avatars.slice(0, 3)} total={Math.min(3, avatars.length)} size={22} max={3} />
              {others > 0 ? <span className="text-[12px] font-bold text-white">+{others.toLocaleString()}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <Link
          href={`/communities/${c.community.slug}/campaigns/${c.campaign_id}`}
          className="line-clamp-2 text-[17px] font-extrabold leading-snug text-ink no-underline after:absolute after:inset-0 after:rounded-[26px] after:content-['']"
        >
          {c.title}
        </Link>
        {total > 0 ? (
          <ProgressBar
            thin
            tone={state === "done" ? "green" : "yellow"}
            value={done / total}
            className="mt-2.5"
            label={`${done} of ${total} ${unit}`}
          />
        ) : null}

        {stakeLine || bonus ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {stakeLine ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                  stakeLine.warn ? "bg-orange-soft text-orange" : "bg-paper text-muted-foreground",
                )}
              >
                {stakeLine.text}
              </span>
            ) : null}
            {bonus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-bold text-green-edge">
                <TrophyArt size={14} />
                {bonus.state === "rewarded"
                  ? `+${formatStake(bonus.amount)} G$ earned`
                  : bonus.state === "completed"
                    ? "Finishing bonus on its way"
                    : `${bonus.reduced ? "Up to " : "+"}${formatStake(bonus.amount)} G$ to finish`}
              </span>
            ) : null}
          </div>
        ) : null}

        {due && milestone ? (
          <GameButton full className="relative z-10 mt-3.5" disabled={proofBusy} onClick={() => onProve(milestone)}>
            Prove today
          </GameButton>
        ) : null}
      </div>
    </div>
  );
}

function CampaignQuestRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse overflow-hidden rounded-[28px] border-2 border-line bg-white shadow-edge", className)}>
      <div className="h-36 bg-line" />
      <div className="space-y-2.5 p-4">
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-2 w-full rounded bg-line" />
      </div>
    </div>
  );
}

/** Phones: a swipe row with the next card peeking in. Tablet up: a 2-up grid. */
const QUEST_ROW_CLASS =
  "scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0";
const QUEST_IN_ROW_CLASS = "w-[86%] shrink-0 snap-start sm:w-full";

export function ActiveCampaignsSection({
  address,
  heading,
  showMax = 3,
  showSeeAll = true,
  showEmpty = false,
  variant = "card",
}: {
  address: string;
  heading?: string;
  showMax?: number;
  showSeeAll?: boolean;
  showEmpty?: boolean;
  /**
   * "quest": compact rows matching Home's quest cards, listing every active
   * joined campaign (due first) — including ones with nothing due right now,
   * so a joined campaign never silently disappears.
   */
  variant?: "card" | "quest";
}) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);
  const { user } = useUserStore();
  // Finishing bonus per campaign, straight from the Rewards Engine (quest cards only).
  const { summary: rewardsSummary } = useRewardsSummary(variant === "quest" ? (address as `0x${string}`) : undefined);
  const finishBonusFor = (campaignId: string): CampaignFinishBonus | null => {
    const p = rewardsSummary?.completions.find((x) => x.kind === "campaign" && x.ref === campaignId);
    if (!p || p.state === "missed") return null;
    return { amount: p.amount, reduced: p.amount < p.fullAmount, state: p.state };
  };

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [proofStep, setProofStep] = useState<
    "idle" | "uploading" | "ai-verifying" | "wallet-sign" | "confirming"
  >("idle");
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
    campaignTitle?: string;
    communitySlug?: string;
    proofType?: string;
    liveCameraDurationSeconds?: number | null;
    pointsPerMilestone: number;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
    void queryClient.invalidateQueries({ queryKey: ["home", "campaigns"] });
    void queryClient.invalidateQueries({ queryKey: ["explore", "campaigns"] });
  }, [address, queryClient]);

  const openProof = (c: JoinedDashboardCampaign, milestone: CommunityCampaignMilestoneRow) => {
    setActiveProof({
      campaignId: c.campaign_id,
      challengeId: c.challenge_id,
      milestoneId: milestone.milestone_id,
      campaignTitle: c.title,
      communitySlug: c.community.slug,
      proofType: c.proof_type,
      liveCameraDurationSeconds: c.live_camera_duration_seconds,
      pointsPerMilestone: pointsPerMilestoneForJoinAmount(c.is_free_to_join ? 0 : c.join_amount),
    });
    setProofSuccess(false);
    setProofError(null);
    setProofStep("idle");
    setProofOpen(true);
  };

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!activeProof) {
      const msg = "Pick a milestone before uploading proof.";
      setProofError(msg);
      throw new Error(msg);
    }
    setProofBusy(true);
    setProofError(null);
    setProofStep("ai-verifying");
    try {
      await submitCommunityProofWithWallet({
        campaignId: activeProof.campaignId,
        walletAddress: address,
        proofUrls,
        milestoneId: activeProof.milestoneId,
        submitOnChain: submitCommunityCampaignMilestoneProofAndWait,
        onStepChange: setProofStep,
      });
      setProofSuccess(true);
      invalidate();
    } catch (err) {
      const msg = proofErrorMessage(err);
      setProofError(msg);
      setProofStep("idle");
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setProofBusy(false);
    }
  };

  // Kept at a fixed spot outside the list: once the last pending milestone is
  // submitted, the refetch empties the list — the modal must stay mounted so
  // the success card (and confetti) still shows.
  const proofModal = (
    <SubmitProofModal
      open={proofOpen}
      onOpenChange={setProofOpen}
      onSubmit={handleProofSubmit}
      proofType={activeProof?.proofType}
      liveCameraDurationSeconds={activeProof?.liveCameraDurationSeconds}
      isSubmitting={proofBusy}
      submitSuccess={proofSuccess}
      submitError={proofError ? new Error(proofError) : null}
      proofStep={proofStep}
      onDone={() => {
        setProofOpen(false);
        setProofSuccess(false);
        setActiveProof(null);
      }}
      isOnChain
      campaignTitle={activeProof?.campaignTitle}
      pointsAwarded={activeProof?.pointsPerMilestone}
      myUsername={user?.username}
      myAvatar={user?.pfpUrl}
      shareUrl={
        activeProof?.communitySlug &&
        activeProof?.campaignId &&
        typeof window !== "undefined"
          ? `${window.location.origin}/communities/${activeProof.communitySlug}/campaigns/${activeProof.campaignId}`
          : null
      }
    />
  );

  const renderQuests = () => {
    if (isLoading) {
      return (
        <section>
          <div className="mb-4 h-6 w-40 animate-pulse rounded-lg bg-ink/10" />
          <div className={QUEST_ROW_CLASS}>
            {[0, 1].map((i) => (
              <CampaignQuestRowSkeleton key={i} className={QUEST_IN_ROW_CLASS} />
            ))}
          </div>
        </section>
      );
    }
    const nowMs = Date.now();
    const sorted = [...(data ?? [])].sort(
      (a, b) => QUEST_ORDER[questStateFor(a, nowMs).state] - QUEST_ORDER[questStateFor(b, nowMs).state],
    );
    if (sorted.length === 0) return null;
    const visible = sorted.slice(0, showMax);
    const hiddenCount = sorted.length - visible.length;
    const single = visible.length === 1;
    return (
      <section>
        {heading ? (
          <SectionHeading action={hiddenCount > 0 ? <Link href="/explore">+{hiddenCount} more →</Link> : undefined}>
            {heading}
          </SectionHeading>
        ) : null}
        <div className={single ? "sm:grid sm:grid-cols-2 sm:gap-4" : QUEST_ROW_CLASS}>
          {visible.map((c) => (
            <CampaignQuestRow
              key={c.campaign_id}
              campaign={c}
              nowMs={nowMs}
              proofBusy={proofBusy && activeProof?.campaignId === c.campaign_id}
              onProve={(m) => openProof(c, m)}
              bonus={finishBonusFor(c.campaign_id)}
              className={single ? "w-full" : QUEST_IN_ROW_CLASS}
            />
          ))}
        </div>
      </section>
    );
  };

  const renderContent = () => {
    if (variant === "quest") return renderQuests();
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <MissionCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    const all = (data ?? []).filter((c) => c.next_milestones.length > 0);
    if (all.length === 0) {
      if (!showEmpty) return null;
      return (
        <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-5 py-12 text-center shadow-sm">
          <p
            className="text-lg font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-body)" }}
          >
            No campaign
          </p>
          <Link
            href="/explore"
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Explore campaigns
          </Link>
        </div>
      );
    }

    const visible = all.slice(0, showMax);
    const hiddenCount = all.length - showMax;

    const showSeeAllLink = showSeeAll && all.length > 1;

    return (
      <div>
        {heading || showSeeAllLink ? (
          <div className={cn("mb-4 flex items-center", heading ? "justify-between" : "justify-end")}>
            {heading ? <p className={FEED_CARD_EYEBROW_CLASS}>{heading}</p> : null}
            {showSeeAllLink && (
              <Link
                href="/explore"
                className="text-[11px] font-semibold text-blue hover:underline"
              >
                {all.length} active →
              </Link>
            )}
          </div>
        ) : null}

        <div className="space-y-4">
          {visible.map((c) => {
            const activeMilestone = getActiveMilestone(c.next_milestones) ?? c.next_milestones[0];
            if (!activeMilestone) return null;
            return (
              <MissionCard
                key={c.campaign_id}
                href={`/communities/${c.community.slug}/campaigns/${c.campaign_id}`}
                title={c.title}
                coverImageUrl={c.cover_image_url}
                milestone={activeMilestone}
                milestoneIndex={activeMilestone.milestone_id + 1}
                milestoneCount={c.milestone_count}
                isFreeToJoin={c.is_free_to_join}
                joinAmount={c.join_amount}
                joinToken={c.join_token}
                forfeitPct={c.forfeit_pct}
                participantCount={c.participant_count}
                participantAvatars={c.participant_avatars}
                proofBusy={proofBusy && activeProof?.campaignId === c.campaign_id}
                onSubmitProof={() => openProof(c, activeMilestone)}
              />
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <Link
            href="/explore"
            className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-border/50 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            +{hiddenCount} more campaign{hiddenCount !== 1 ? "s" : ""} →
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      {proofModal}
    </>
  );
}
