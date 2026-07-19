"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { Check, Loader2, SlidersHorizontal, Target } from "lucide-react";
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

type DurationFilter = "all" | "7" | "14" | "30" | "60" | "ended";

const DURATION_OPTIONS: { value: DurationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "ended", label: "Ended" },
];

export function ExploreCampaignsSection({ address }: { address?: string }) {
  const router = useRouter();
  const joinFlow = useCampaignJoinFlow();
  const { requireAuth } = useRedirectToSignIn();
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
  const [endingSoon, setEndingSoon] = useState(false);

  // Default view (and every duration filter) shows the newest campaigns
  // first. "Ending soon" is the one case that intentionally overrides that
  // with soonest-to-end ranking (handled server-side under "participants" sort).
  const sort: ExploreCampaignsSort = endingSoon ? "participants" : "recent";
  const durationDays = ["7", "14", "30", "60"].includes(durationFilter)
    ? (Number(durationFilter) as 7 | 14 | 30 | 60)
    : undefined;
  const ended = durationFilter === "ended";
  const isDefaultView = durationFilter === "all" && !endingSoon;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
    isRefetching,
  } = useExploreCampaigns(address, sort, { durationDays, endingSoon, ended });
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

  const selectedDurationLabel = DURATION_OPTIONS.find((o) => o.value === durationFilter)?.label;

  const filterBar = (
    <div className="mb-4 flex items-center gap-2.5 overflow-x-auto scrollbar-hide">
      <Select.Root
        value={durationFilter}
        onValueChange={(value) => {
          const next = value as DurationFilter;
          setDurationFilter(next);
          // "Ending soon" only makes sense for still-active campaigns.
          if (next === "ended") setEndingSoon(false);
        }}
      >
        <Select.Trigger
          aria-label="Filter by duration"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors outline-none",
            durationFilter !== "all"
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          {durationFilter !== "all" ? selectedDurationLabel : null}
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 overflow-hidden rounded-xl border border-border bg-background shadow-lg"
          >
            <Select.Viewport className="p-1">
              {DURATION_OPTIONS.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm font-semibold text-foreground outline-none data-[highlighted]:bg-muted"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <button
        type="button"
        onClick={() => setEndingSoon((v) => !v)}
        disabled={durationFilter === "ended"}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-40",
          endingSoon
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        Ending soon
      </button>
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
            {isDefaultView ? "No active campaigns yet" : "No campaigns match this filter"}
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
