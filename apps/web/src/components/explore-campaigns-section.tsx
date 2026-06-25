"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { CampaignJoinFlowOverlay } from "@/components/community/campaign-join-flow-overlay";
import { useCampaignJoinFlow } from "@/hooks/use-campaign-join-flow";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";

export function ExploreCampaignsSection({ address }: { address?: string }) {
  const router = useRouter();
  const joinFlow = useCampaignJoinFlow();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
    isRefetching,
  } = useExploreCampaigns(address);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const campaigns = data?.pages.flatMap((page) => page.campaigns) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const openJoin = useCallback(
    (campaign: CampaignExploreCardData) => {
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
    },
    [joinFlow],
  );

  const handleJoined = useCallback(
    async (campaignId: string) => {
      await refetch();
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (campaign?.community?.slug) {
        router.push(`/communities/${campaign.community.slug}/campaigns/${campaignId}`);
      }
    },
    [campaigns, refetch, router],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load campaigns. Try again.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isRefetching}
          className="text-sm font-semibold text-delulu-blue"
        >
          {isRefetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Target className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No active campaigns yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={c}
            joining={joinFlow.pendingCampaignId === c.id && joinFlow.joining}
            onJoin={() => openJoin(c)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground")} />
        </div>
      ) : null}

      <CampaignJoinFlowOverlay flow={joinFlow} address={address} onJoined={handleJoined} />
    </div>
  );
}
