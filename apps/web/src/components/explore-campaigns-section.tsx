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
import { joinCommunityCampaignWithWallet } from "@/lib/community/join-campaign-client";
import { useJoinCommunityCampaignOnChain } from "@/hooks/use-community-campaign-onchain";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";

export function ExploreCampaignsSection({ address }: { address?: string }) {
  const router = useRouter();
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
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
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
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

  const runJoin = useCallback(
    async (campaign: CampaignExploreCardData) => {
      if (!address) return;
      setJoiningId(campaign.id);
      setJoinError(null);
      try {
        const result = await joinCommunityCampaignWithWallet(
          campaign.id,
          address,
          joinCommunityCampaignAndWait,
        );
        await refetch();
        if (result.joinedCampaign || result.alreadyJoined) {
          router.push(`/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`);
        }
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Join failed");
      } finally {
        setJoiningId(null);
      }
    },
    [address, joinCommunityCampaignAndWait, refetch, router],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
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
      {joinError ? (
        <p className="mb-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {joinError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {campaigns.map((c) => (
          <CampaignExploreCard
            key={c.id}
            campaign={c}
            joining={joiningId === c.id}
            onJoin={() => void runJoin(c)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground")} />
        </div>
      ) : null}
    </div>
  );
}
