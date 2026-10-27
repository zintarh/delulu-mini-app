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
import { CheckDot, GameButton, MonoLabel, ProgressBar, Trophy as TrophyArt } from "@/components/ds";
import type { JoinedDashboardCampaign } from "@/hooks/use-user-campaign-milestones";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";
import { pointsPerMilestoneForJoinAmount } from "@/lib/dashboard/campaign-constants";

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

/** Joined campaign as a Home quest row — same shape as a forfeit quest card. */
export function CampaignQuestRow({
  campaign: c,
  nowMs,
  proofBusy,
  onProve,
}: {
  campaign: JoinedDashboardCampaign;
  nowMs: number;
  proofBusy: boolean;
  onProve: (_milestone: CommunityCampaignMilestoneRow) => void;
}) {
  const { state, milestone } = questStateFor(c, nowMs);
  const total = c.milestone_count;
  const progress = total > 0 ? `${c.completed_count}/${total}` : null;
  const meta =
    state === "due" && milestone
      ? `due ${formatDeadline(milestone.deadline, nowMs)}`
      : state === "upcoming" && milestone
        ? `next ${formatDeadline(milestone.start_time, nowMs)}`
        : state === "done"
          ? "all proofs in"
          : "no proof due";

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-[20px] border-2 bg-white p-3",
        state === "due" ? "border-yellow-line shadow-edge-yellow-line" : "border-line shadow-edge",
      )}
    >
      <span className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#fdf1c7]">
        {c.cover_image_url ? (
          <Image src={c.cover_image_url} alt="" fill className="object-cover" unoptimized />
        ) : (
          <TrophyArt size={30} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/communities/${c.community.slug}/campaigns/${c.campaign_id}`}
          className="block truncate text-base font-bold text-ink no-underline after:absolute after:inset-0 after:rounded-[18px] after:content-['']"
        >
          {c.title}
        </Link>
        <div className="mt-[7px] flex items-center gap-2">
          {total > 0 ? (
            <ProgressBar
              thin
              tone="yellow"
              value={c.completed_count / total}
              className="w-16"
              label={`${c.completed_count} of ${total} proofs`}
            />
          ) : null}
          <span className="label-mono truncate text-[10px] text-muted-foreground">
            {progress ? `${progress} · ` : ""}
            <span className="normal-case">{meta}</span>
          </span>
        </div>
      </div>
      <div className="relative z-10 shrink-0">
        {state === "due" && milestone ? (
          <GameButton size="sm" disabled={proofBusy} onClick={() => onProve(milestone)}>
            Prove
          </GameButton>
        ) : state === "upcoming" ? (
          <span className="rounded-full bg-muted/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
            Up next
          </span>
        ) : state === "done" ? (
          <CheckDot />
        ) : null}
      </div>
    </div>
  );
}

function CampaignQuestRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-[20px] border-2 border-line bg-white p-3 shadow-edge">
      <div className="h-[50px] w-[50px] rounded-2xl bg-line" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-2.5 w-1/3 rounded bg-line" />
      </div>
    </div>
  );
}

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
        <div className="space-y-2.5">
          <div className="mb-2.5 h-3 w-28 animate-pulse rounded bg-line" />
          {[0, 1].map((i) => (
            <CampaignQuestRowSkeleton key={i} />
          ))}
        </div>
      );
    }
    const nowMs = Date.now();
    const sorted = [...(data ?? [])].sort(
      (a, b) => QUEST_ORDER[questStateFor(a, nowMs).state] - QUEST_ORDER[questStateFor(b, nowMs).state],
    );
    if (sorted.length === 0) return null;
    const visible = sorted.slice(0, showMax);
    const hiddenCount = sorted.length - visible.length;
    return (
      <section>
        {heading ? (
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <MonoLabel>{heading}</MonoLabel>
            {hiddenCount > 0 ? (
              <Link href="/explore" className="text-[11px] font-semibold text-blue no-underline">
                +{hiddenCount} more
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2.5">
          {visible.map((c) => (
            <CampaignQuestRow
              key={c.campaign_id}
              campaign={c}
              nowMs={nowMs}
              proofBusy={proofBusy && activeProof?.campaignId === c.campaign_id}
              onProve={(m) => openProof(c, m)}
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
