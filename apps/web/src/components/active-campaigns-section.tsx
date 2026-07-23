"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitProofModal } from "@/components/submit-proof-modal";
import { MissionCard, MissionCardSkeleton } from "@/components/community/mission-card";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
} from "@/hooks/use-user-campaign-milestones";
import { submitCommunityProofWithWallet } from "@/lib/community/join-campaign-client";
import { useSubmitCommunityMilestoneProofOnChain } from "@/hooks/use-community-campaign-onchain";
import { useUserStore } from "@/stores/useUserStore";
import { getActiveMilestone } from "@/lib/community/milestone-submit-eligibility";

/**
 * Shows joined community campaigns as explore cards with inline active milestone
 * and a Upload proof button. Used on the home feed and profile Active tab.
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
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
    void queryClient.invalidateQueries({ queryKey: ["home", "campaigns"] });
    void queryClient.invalidateQueries({ queryKey: ["explore", "campaigns"] });
  }, [address, queryClient]);

  const handleProofSubmit = async (proofUrls: string[]) => {
    if (!activeProof) return;
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
      setProofError(err instanceof Error ? err.message : "Proof failed");
      setProofStep("idle");
    } finally {
      setProofBusy(false);
    }
  };

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
  if (all.length === 0) return null;

  const visible = all.slice(0, showMax);
  const hiddenCount = all.length - showMax;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40"
          style={{ fontFamily: "var(--font-manrope)" }}
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
              onSubmitProof={() => {
                setActiveProof({
                  campaignId: c.campaign_id,
                  challengeId: c.challenge_id,
                  milestoneId: activeMilestone.milestone_id,
                  campaignTitle: c.title,
                  communitySlug: c.community.slug,
                  proofType: c.proof_type,
                  liveCameraDurationSeconds: c.live_camera_duration_seconds,
                });
                setProofSuccess(false);
                setProofError(null);
                setProofStep("idle");
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
