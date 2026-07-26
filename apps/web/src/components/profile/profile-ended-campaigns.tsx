"use client";

import { Plus } from "lucide-react";
import {
  CampaignExploreCard,
  CampaignExploreCardSkeleton,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { useJoinedEndedCampaigns } from "@/hooks/use-joined-ended-campaigns";

export function ProfileEndedCampaigns({ address }: { address: string }) {
  const { data, isLoading } = useJoinedEndedCampaigns(address);
  const campaigns = data ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CampaignExploreCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Plus className="h-7 w-7 text-muted-foreground" />
        </div>
        <p
          className="mb-1 text-lg font-black text-foreground"
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          No ended campaigns yet
        </p>
        <p
          className="text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Campaigns you joined that have finished will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {campaigns.map((campaign: CampaignExploreCardData) => (
        <CampaignExploreCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
