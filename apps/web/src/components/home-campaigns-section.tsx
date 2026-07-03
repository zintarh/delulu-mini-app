"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ProofModal } from "@/components/proof-modal";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import {
  homeCampaignKeys,
  useHomeCampaignsFeed,
} from "@/hooks/use-home-campaigns-feed";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
  type JoinedDashboardCampaign,
} from "@/hooks/use-user-campaign-milestones";
import {
  submitCommunityProofWithWallet,
} from "@/lib/community/join-campaign-client";
import {
  useSubmitCommunityMilestoneProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import {
  canSubmitMilestone,
  getActiveMilestone,
} from "@/lib/community/milestone-submit-eligibility";

function feedItemToCardData(c: CommunityCampaignFeedItem): CampaignExploreCardData {
  return {
    id: c.id,
    title: c.title,
    proposedPoolAmount: c.proposed_pool_amount,
    durationDays: c.duration_days,
    coverImageUrl: c.cover_image_url,
    displayEndsAt: c.display_ends_at,
    status: c.status,
    participantCount: c.participant_count ?? 0,
    milestoneCount: c.milestone_count ?? 0,
    canJoin: c.can_join ?? false,
    isOnChain: isValidOnChainChallengeId(c.on_chain_challenge_id ?? null),
    isJoined: c.participant_state === "joined",
    isFreeToJoin: c.is_free_to_join,
    joinToken: c.join_token ?? "G$",
    joinAmount: Number(c.join_amount ?? 0),
    forfeitPct: Number(c.forfeit_pct ?? 0),
    proofInstructions: c.proof_instructions ?? null,
    proofCadence: c.proof_cadence,
    prizeWinnerCount: c.prize_winner_count,
    telegramLink: c.telegram_link ?? null,
    community: { name: c.community.name, slug: c.community.slug },
  };
}

function dashboardCampaignToCardData(c: JoinedDashboardCampaign): CampaignExploreCardData {
  const activeMilestone = getActiveMilestone(c.next_milestones) ?? c.next_milestones[0] ?? null;
  return {
    id: c.campaign_id,
    title: c.title,
    community: c.community,
    coverImageUrl: c.cover_image_url,
    displayEndsAt: c.display_ends_at,
    durationDays: c.duration_days,
    milestoneCount: c.milestone_count,
    proposedPoolAmount: 0,
    status: "active",
    participantCount: 0,
    isJoined: true,
    activeMilestone: activeMilestone
      ? {
          milestone_id: activeMilestone.milestone_id,
          label: activeMilestone.label,
          deadline: activeMilestone.deadline ?? null,
          start_time: activeMilestone.start_time ?? null,
          is_overdue: activeMilestone.is_overdue,
        }
      : null,
  };
}

/**
 * Immersive mission cards — one per joined campaign with a pending milestone.
 * Proof modal state lives here so submissions happen without page navigation.
 */
function TodaysMilestonesSection({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);

  const { user } = useUserStore();
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
    campaignTitle?: string;
    communitySlug?: string;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: ["explore", "campaigns"] });
  }, [address, queryClient]);

  const handleProofSubmit = async (imageUrl: string) => {
    if (!activeProof) return;
    setProofBusy(true);
    setProofError(null);
    try {
      await submitCommunityProofWithWallet({
        campaignId: activeProof.campaignId,
        walletAddress: address,
        proofUrl: imageUrl,
        milestoneId: activeProof.milestoneId,
        submitOnChain: submitCommunityCampaignMilestoneProofAndWait,
      });
      setProofSuccess(true);
      invalidate();
    } catch (err) {
      setProofError(err instanceof Error ? err.message : "Proof failed");
    } finally {
      setProofBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 py-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  const active = (data ?? []).filter((c) => c.next_milestones.length > 0);
  if (active.length === 0) return null;

  const SHOW_MAX = 3;
  const visible = active.slice(0, SHOW_MAX);
  const hiddenCount = active.length - SHOW_MAX;

  return (
    <div className="px-4 py-2">
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-[11px] font-black uppercase tracking-[0.16em] text-foreground/60"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Your missions
        </p>
        {active.length > 1 && (
          <Link
            href="/communities/joined"
            className="text-[11px] font-semibold text-delulu-blue hover:underline"
          >
            {active.length} active →
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {visible.map((c) => {
          const activeMilestone = getActiveMilestone(c.next_milestones) ?? c.next_milestones[0];
          return (
            <CampaignExploreCard
              key={c.campaign_id}
              campaign={dashboardCampaignToCardData(c)}
              joining={false}
              onJoin={() => {}}
              proofBusy={proofBusy && activeProof?.campaignId === c.campaign_id}
              onSubmitMilestone={() => {
                if (!activeMilestone || !canSubmitMilestone(activeMilestone)) return;
                setActiveProof({
                  campaignId: c.campaign_id,
                  challengeId: c.challenge_id,
                  milestoneId: activeMilestone.milestone_id,
                  campaignTitle: c.title,
                  communitySlug: c.community.slug,
                });
                setProofSuccess(false);
                setProofError(null);
                setProofOpen(true);
              }}
            />
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <Link
          href="/communities/joined"
          className="mt-2.5 flex w-full items-center justify-center rounded-xl border border-border/50 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          +{hiddenCount} more campaign{hiddenCount !== 1 ? "s" : ""} →
        </Link>
      )}

      <ProofModal
        open={proofOpen}
        onOpenChange={setProofOpen}
        onSubmit={handleProofSubmit}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        onDone={() => {
          setProofOpen(false);
          setProofSuccess(false);
          setActiveProof(null);
        }}
        isOnChain
        campaignTitle={activeProof?.campaignTitle}
        myUsername={user?.username}
        myAvatar={user?.pfpUrl}
        shareUrl={
          activeProof?.communitySlug && activeProof?.campaignId && typeof window !== "undefined"
            ? `${window.location.origin}/communities/${activeProof.communitySlug}/campaigns/${activeProof.campaignId}`
            : null
        }
      />
    </div>
  );
}

function DiscoverCampaignsSection({
  address,
  onJoin,
  joiningId,
}: {
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
}) {
  const { data, isLoading } = useHomeCampaignsFeed("ongoing", address);
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, 5);

  if (isLoading) {
    return (
      <div className="px-4 py-2 space-y-3">
        <div className="h-4 w-36 animate-pulse rounded-lg bg-muted" />
        {[1, 2].map((i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) return null; // nothing new to discover — don't show empty section

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          You might also like
        </p>
        <Link
          href="/explore?tab=campaigns"
          className="text-[11px] font-semibold text-delulu-blue hover:underline"
        >
          See all →
        </Link>
      </div>

      <div className="space-y-4">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={feedItemToCardData(c)}
            joining={joiningId === c.id}
            onJoin={() => onJoin(c)}
          />
        ))}
      </div>
    </div>
  );
}

export function HomeCampaignsSection() {
  const { address } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const joinFlow = useCampaignJoinFlow();
  const pendingJoinRef = useRef<CommunityCampaignFeedItem | null>(null);

  const invalidateFeeds = useCallback(() => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const openJoin = useCallback(
    (campaign: CommunityCampaignFeedItem) => {
      pendingJoinRef.current = campaign;
      joinFlow.openJoinModal(campaign.id, {
        title: campaign.title,
        community: { name: campaign.community.name },
        duration_days: campaign.duration_days,
        milestone_count: campaign.milestone_count,
        is_free_to_join: campaign.is_free_to_join,
        join_token: campaign.join_token,
        join_amount: campaign.join_amount,
        forfeit_pct: campaign.forfeit_pct,
        proposed_pool_amount: campaign.proposed_pool_amount,
        prize_winner_count: campaign.prize_winner_count,
        proof_cadence: campaign.proof_cadence,
        proof_instructions: campaign.proof_instructions,
        status: campaign.status,
      });
    },
    [joinFlow],
  );

  const handleJoined = useCallback(
    async (campaignId: string) => {
      invalidateFeeds();
      const campaign = pendingJoinRef.current;
      pendingJoinRef.current = null;
      if (campaign && campaign.id === campaignId) {
        router.push(`/communities/${campaign.community.slug}/campaigns/${campaignId}`);
      }
    },
    [invalidateFeeds, router],
  );

  if (!address) return null;

  return (
    <>
      <TodaysMilestonesSection address={address} />
      <DiscoverCampaignsSection
        address={address}
        onJoin={openJoin}
        joiningId={
          joinFlow.joining ? joinFlow.pendingCampaignId : null
        }
      />
      <CampaignJoinFlowOverlay
        flow={joinFlow}
        address={address}
        onJoined={handleJoined}
      />
    </>
  );
}
