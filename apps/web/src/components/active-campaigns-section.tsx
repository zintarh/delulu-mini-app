"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ProofModal } from "@/components/proof-modal";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
  type JoinedDashboardCampaign,
} from "@/hooks/use-user-campaign-milestones";
import { submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import { useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { useUserStore } from "@/stores/useUserStore";
import {
  canSubmitMilestone,
  getActiveMilestone,
} from "@/lib/community/milestone-submit-eligibility";

export function dashboardCampaignToCardData(c: JoinedDashboardCampaign): CampaignExploreCardData {
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
 * Shows joined community campaigns as explore cards with inline active milestone
 * and a Submit proof button. Used on the home feed and profile Active tab.
 */
export function ActiveCampaignsSection({
  address,
  heading = "Your missions",
  showMax = 3,
  showSeeAll = true,
}: {
  address: string;
  heading?: string;
  showMax?: number;
  showSeeAll?: boolean;
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
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
    campaignTitle?: string;
    communitySlug?: string;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
    void queryClient.invalidateQueries({ queryKey: ["home", "campaigns"] });
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
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const all = (data ?? []).filter((c) => c.next_milestones.length > 0);
  if (all.length === 0) return null;

  const visible = all.slice(0, showMax);
  const hiddenCount = all.length - showMax;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-sm font-black uppercase tracking-[0.16em]"
          style={{
            fontFamily: "var(--font-manrope)",
            background: "linear-gradient(135deg, #9a7b0a 0%, #f6c324 45%, #c8960a 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {heading}
        </p>
        {showSeeAll && all.length > 1 && (
          <Link
            href="/communities/joined"
            className="text-[11px] font-semibold text-delulu-blue hover:underline"
          >
            {all.length} active →
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
          activeProof?.communitySlug &&
          activeProof?.campaignId &&
          typeof window !== "undefined"
            ? `${window.location.origin}/communities/${activeProof.communitySlug}/campaigns/${activeProof.campaignId}`
            : null
        }
      />
    </div>
  );
}
