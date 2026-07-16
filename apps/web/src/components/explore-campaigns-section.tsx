"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useExploreCampaigns, type ExploreCampaignsSort } from "@/hooks/use-explore-campaigns";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";

type FilterPill = "all" | "ending_soon" | "7" | "14" | "30" | "newest";

const FILTER_PILLS: { id: FilterPill; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ending_soon", label: "Ending soon" },
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "newest", label: "Newest" },
];

export function ExploreCampaignsSection({ address }: { address?: string }) {
  const router = useRouter();
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const [activeFilter, setActiveFilter] = useState<FilterPill>("all");

  const sort: ExploreCampaignsSort = activeFilter === "newest" ? "recent" : "participants";
  const durationDays = ["7", "14", "30"].includes(activeFilter)
    ? (Number(activeFilter) as 7 | 14 | 30)
    : undefined;
  const endingSoon = activeFilter === "ending_soon";

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
    isRefetching,
  } = useExploreCampaigns(address, sort, { durationDays, endingSoon });
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

  const filterBar = (
    <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
      {FILTER_PILLS.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => setActiveFilter(pill.id)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
            activeFilter === pill.id
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {filterBar}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <CampaignExploreCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {filterBar}
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
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div>
        {filterBar}
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {activeFilter === "all" ? "No active campaigns yet" : "No campaigns match this filter"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {filterBar}
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
