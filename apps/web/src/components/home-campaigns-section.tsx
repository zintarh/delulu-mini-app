"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { ProofModal } from "@/components/proof-modal";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import { CampaignSectionSkeleton } from "@/components/community/campaign-horizontal-card";
import {
  homeCampaignKeys,
  useHomeCampaignsFeed,
} from "@/hooks/use-home-campaigns-feed";
import {
  joinedDashboardKeys,
  useJoinedCampaignDashboard,
} from "@/hooks/use-user-campaign-milestones";
import {
  joinCommunityCampaignWithWallet,
  submitCommunityProofWithWallet,
} from "@/lib/community/join-campaign-client";
import {
  useJoinCommunityCampaignOnChain,
  useSubmitCommunityMilestoneProofOnChain,
} from "@/hooks/use-community-campaign-onchain";
import { useAuth } from "@/hooks/use-auth";

function feedItemToCardData(c: CommunityCampaignFeedItem): CampaignExploreCardData {
  return {
    id: c.id,
    title: c.title,
    proposedPoolAmount: c.proposed_pool_amount,
    durationDays: c.duration_days,
    coverImageUrl: c.cover_image_url,
    displayEndsAt: c.display_ends_at,
    status: c.status,
    participantCount: 0,
    milestoneCount: c.milestone_count ?? 0,
    isJoined: c.participant_state === "joined",
    community: { name: c.community.name, slug: c.community.slug },
  };
}

/**
 * "Submit proof" section — shows only the active (next) milestone per joined campaign.
 * Proof modal state lives here so submissions happen without page navigation.
 */
function TodaysMilestonesSection({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
    proofInstructions?: string | null;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
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

  if (isLoading) return <CampaignSectionSkeleton rows={2} />;

  // Only show campaigns that have an active (next) milestone to submit
  const active = (data ?? []).filter((c) => c.next_milestones.length > 0);
  if (active.length === 0) return null;

  const SHOW_MAX = 3;
  const visible = active.slice(0, SHOW_MAX);
  const hiddenCount = active.length - SHOW_MAX;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Submit proof
        </p>
        <Link
          href="/communities"
          className="text-[11px] font-semibold text-delulu-blue hover:underline"
        >
          All campaigns ({active.length}) →
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {visible.map((c, idx) => {
          const milestone = c.next_milestones[0];
          const isLast = idx === visible.length - 1 && hiddenCount === 0;
          const isBusy = proofBusy && activeProof?.campaignId === c.campaign_id;

          return (
            <div
              key={c.campaign_id}
              className={
                isLast ? undefined : "border-b border-border/50"
              }
            >
              <div className="flex items-center gap-3 p-3.5">
                {/* Thumbnail */}
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-delulu-blue-light">
                  {c.cover_image_url ? (
                    <Image
                      src={c.cover_image_url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-delulu-blue/40">
                      <Target className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {c.title}
                  </p>
                  <p className="truncate text-sm font-bold text-foreground">
                    {milestone.label}
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setActiveProof({
                      campaignId: c.campaign_id,
                      challengeId: c.challenge_id,
                      milestoneId: milestone.milestone_id,
                    });
                    setProofSuccess(false);
                    setProofError(null);
                    setProofOpen(true);
                  }}
                  className="shrink-0 rounded-xl bg-delulu-blue px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {isBusy ? "…" : "Submit proof"}
                </button>
              </div>
            </div>
          );
        })}

        {/* "N more" row */}
        {hiddenCount > 0 ? (
          <div className="border-t border-border/50">
            <Link
              href="/communities"
              className="flex w-full items-center justify-center py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              +{hiddenCount} more campaign{hiddenCount !== 1 ? "s" : ""} →
            </Link>
          </div>
        ) : null}
      </div>

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
      />
    </div>
  );
}

function DiscoverCampaignsSection({
  address,
  onJoin,
  joiningId,
  joinError,
}: {
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
  joinError: string | null;
}) {
  const { data, isLoading } = useHomeCampaignsFeed("ongoing", address);
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, 4);

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

  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Discover campaigns
        </p>
        <Link
          href="/explore?tab=campaigns"
          className="text-[11px] font-semibold text-delulu-blue hover:underline"
        >
          See all →
        </Link>
      </div>

      {joinError ? (
        <p className="mb-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}

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
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const invalidateFeeds = useCallback(() => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const runJoin = useCallback(
    async (campaign: CommunityCampaignFeedItem) => {
      if (!address) return;
      setJoiningId(campaign.id);
      setJoinError(null);
      try {
        const result = await joinCommunityCampaignWithWallet(
          campaign.id,
          address,
          joinCommunityCampaignAndWait,
        );
        invalidateFeeds();
        if (result.joinedCampaign || result.alreadyJoined) {
          router.push(`/communities/${campaign.community.slug}/campaigns/${campaign.id}`);
        }
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Join failed");
      } finally {
        setJoiningId(null);
      }
    },
    [address, invalidateFeeds, joinCommunityCampaignAndWait, router],
  );

  if (!address) return null;

  return (
    <>
      <TodaysMilestonesSection address={address} />
      <DiscoverCampaignsSection
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
        joinError={joiningId ? joinError : null}
      />
    </>
  );
}
