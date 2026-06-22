"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Target } from "lucide-react";
import { ProofModal } from "@/components/proof-modal";
import { CommunityCampaignMilestoneList } from "@/components/community/community-campaign-milestone-list";
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
import { cn } from "@/lib/utils";

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

function ActiveCampaignsPanel({
  address,
  joinError,
}: {
  address: string;
  joinError: string | null;
}) {
  const queryClient = useQueryClient();
  const { submitCommunityCampaignMilestoneProofAndWait } =
    useSubmitCommunityMilestoneProofOnChain();
  const { data, isLoading } = useJoinedCampaignDashboard(address);
  const campaigns = data ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState(false);
  const [activeProof, setActiveProof] = useState<{
    campaignId: string;
    challengeId: number;
    milestoneId: number;
  } | null>(null);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const openProof = useCallback(
    (campaignId: string, challengeId: number, milestoneId: number) => {
      setActiveProof({ campaignId, challengeId, milestoneId });
      setProofSuccess(false);
      setProofError(null);
      setProofOpen(true);
    },
    [],
  );

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
  if (campaigns.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          🔥 Today&apos;s challenges
        </p>
        <span className="rounded-full bg-delulu-blue-light px-1.5 py-0.5 text-[10px] font-bold text-delulu-blue">
          {campaigns.length}
        </span>
      </div>

      {joinError ? (
        <p className="mb-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}

      <div className="space-y-2.5">
        {campaigns.map((c) => {
          const href = `/communities/${c.community.slug}/campaigns/${c.campaign_id}`;
          const nextDue = c.next_milestones[0];
          const allDone = c.milestone_count > 0 && c.completed_count >= c.milestone_count;
          const isExpanded = expandedId === c.campaign_id;
          const isBusy = proofBusy && activeProof?.campaignId === c.campaign_id;

          return (
            <div
              key={c.campaign_id}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
            >
              {/* Header row */}
              <button
                type="button"
                className="flex w-full items-start gap-3 p-3.5 text-left"
                onClick={() => setExpandedId(isExpanded ? null : c.campaign_id)}
              >
                {/* Cover thumbnail */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-delulu-blue-light">
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
                      <Target className="h-5 w-5" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{c.title}</p>
                  {allDone ? (
                    <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                      🎉 All done!
                    </p>
                  ) : nextDue ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      📍 {nextDue.label}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.community.name}
                    </p>
                  )}
                </div>

                {/* Expand chevron */}
                <ChevronDown
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>

              {/* Quick action row — visible when collapsed + has active milestone */}
              {!isExpanded && !allDone && nextDue ? (
                <div className="flex items-center gap-2 border-t border-border/40 px-3.5 pb-3.5 pt-2.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      openProof(c.campaign_id, c.challenge_id, nextDue.milestone_id)
                    }
                    className="flex flex-1 items-center justify-center rounded-xl bg-delulu-blue py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {isBusy ? "Submitting…" : "Submit proof"}
                  </button>
                  <Link
                    href={href}
                    className="shrink-0 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    View →
                  </Link>
                </div>
              ) : !isExpanded && allDone ? (
                <div className="border-t border-border/40 px-3.5 pb-3.5 pt-2.5">
                  <Link
                    href={href}
                    className="flex w-full items-center justify-center rounded-xl border border-border/60 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    View campaign →
                  </Link>
                </div>
              ) : null}

              {/* Expanded: full milestone list */}
              {isExpanded ? (
                <div className="border-t border-border/40 px-3.5 pb-3.5 pt-3">
                  <CommunityCampaignMilestoneList
                    milestones={c.next_milestones}
                    isJoined
                    proofBusy={isBusy}
                    activeMilestoneId={
                      activeProof?.campaignId === c.campaign_id
                        ? activeProof.milestoneId
                        : null
                    }
                    onSubmitMilestone={(milestoneId) =>
                      openProof(c.campaign_id, c.challenge_id, milestoneId)
                    }
                  />
                  <Link
                    href={href}
                    className="mt-3 flex w-full items-center justify-center rounded-xl border border-border/60 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    Full campaign →
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
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
  const campaigns = (data?.pages.flatMap((p) => p.campaigns) ?? []).slice(0, 6);

  if (isLoading) {
    return (
      <div className="px-4 py-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="h-3.5 w-36 animate-pulse rounded bg-muted" />
          <p className="h-3 w-12 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <CampaignExploreCardSkeleton key={i} className="w-[160px] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  return (
    <div className="py-2">
      <div className="mb-3 flex items-center justify-between px-4">
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
        <p className="mx-4 mb-2 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}

      {/* Horizontal poster card scroll */}
      <div className="-mb-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide">
        {campaigns.map((c) => (
          <div key={c.id} className="w-[160px] shrink-0 snap-start">
            <CampaignExploreCard
              campaign={feedItemToCardData(c)}
              joining={joiningId === c.id}
              onJoin={() => onJoin(c)}
            />
          </div>
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
      <ActiveCampaignsPanel address={address} joinError={joiningId ? null : joinError} />
      <DiscoverCampaignsSection
        address={address}
        onJoin={runJoin}
        joiningId={joiningId}
        joinError={joiningId ? joinError : null}
      />
    </>
  );
}
