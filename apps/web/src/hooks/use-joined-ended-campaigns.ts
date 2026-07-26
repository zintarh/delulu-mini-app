"use client";

import { useQuery } from "@tanstack/react-query";
import type { CampaignExploreCardData } from "@/components/community/campaign-explore-card";

export const joinedEndedKeys = {
  all: (address: string) => ["profile", "joined-ended", address.toLowerCase()] as const,
};

async function fetchJoinedEndedCampaigns(
  address: string,
): Promise<CampaignExploreCardData[]> {
  const res = await fetch(
    `/api/community/campaigns/joined-ended?address=${encodeURIComponent(address)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to load ended campaigns");
  return (json.campaigns ?? []) as CampaignExploreCardData[];
}

export function useJoinedEndedCampaigns(address: string | undefined) {
  return useQuery({
    queryKey: joinedEndedKeys.all(address ?? ""),
    queryFn: () => fetchJoinedEndedCampaigns(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
  });
}
