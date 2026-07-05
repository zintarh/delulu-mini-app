"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import type { CommunityCampaignFeedItem } from "@/lib/community/campaign-types";
import { homeCampaignKeys, useHomeCampaignsFeed } from "@/hooks/use-home-campaigns-feed";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";
import { joinedDashboardKeys } from "@/hooks/use-user-campaign-milestones";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { useAuth } from "@/hooks/use-auth";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";

function ExploreLink() {
  return (
    <Link
      href="/explore?tab=campaigns"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-muted/40 py-1 pl-2.5 pr-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted/70"
    >
      Explore
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

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


function DiscoverCampaignsSection({
  address,
  onJoin,
  joiningId,
}: {
  address: string;
  onJoin: (campaign: CommunityCampaignFeedItem) => void;
  joiningId: string | null;
}) {
  const { data, isLoading } = useHomeCampaignsFeed("ongoing", address, "participants");
  const campaigns = data?.pages.flatMap((p) => p.campaigns) ?? [];

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
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">
          You might also like
        </p>
        <ExploreLink />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

function GuestDiscoverCampaignsSection() {
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const { data, isLoading } = useExploreCampaigns(undefined, "participants");
  const campaigns = data?.pages.flatMap((p) => p.campaigns) ?? [];

  const openJoin = useCallback(
    (campaign: CampaignExploreCardData) => {
      requireAuth(() => {
        joinFlow.openJoinModal(campaign.id, {
          title: campaign.title,
          community: campaign.community ? { name: campaign.community.name } : null,
          durationDays: campaign.durationDays,
          milestoneCount: campaign.milestoneCount,
          isFreeToJoin: campaign.isFreeToJoin,
          joinToken: campaign.joinToken,
          joinAmount: campaign.joinAmount,
          forfeitPct: campaign.forfeitPct,
          proposedPoolAmount: campaign.proposedPoolAmount,
          prizeWinnerCount: campaign.prizeWinnerCount,
          proofCadence: campaign.proofCadence,
          proofInstructions: campaign.proofInstructions,
          status: campaign.status,
        });
      });
    },
    [joinFlow, requireAuth],
  );

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">
          Discover campaigns
        </p>
        <ExploreLink />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={c}
            joining={joinFlow.pendingCampaignId === c.id && joinFlow.joining}
            onJoin={() => openJoin(c)}
          />
        ))}
      </div>

      <CampaignJoinFlowOverlay flow={joinFlow} onJoined={() => {}} />
    </div>
  );
}

export function HomeCampaignsSection() {
  const { address } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const pendingJoinRef = useRef<CommunityCampaignFeedItem | null>(null);

  const invalidateFeeds = useCallback(() => {
    if (!address) return;
    void queryClient.invalidateQueries({ queryKey: homeCampaignKeys.feed("ongoing", address) });
    void queryClient.invalidateQueries({ queryKey: joinedDashboardKeys.all(address) });
  }, [address, queryClient]);

  const openJoin = useCallback(
    (campaign: CommunityCampaignFeedItem) => {
      requireAuth(() => {
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
      });
    },
    [joinFlow, requireAuth],
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

  if (!address) {
    return <GuestDiscoverCampaignsSection />;
  }

  return (
    <>
      <div className="px-4 pt-6 pb-2">
        <ActiveCampaignsSection address={address} />
      </div>

      <div className="mt-10" />

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
