"use client";

import { useQuery } from "@tanstack/react-query";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";

export type JoinedDashboardCampaign = {
  campaign_id: string;
  challenge_id: number;
  title: string;
  community: { name: string; slug: string };
  cover_image_url: string | null;
  display_ends_at: string | null;
  duration_days: number;
  milestone_count: number;
  completed_count: number;
  next_milestones: CommunityCampaignMilestoneRow[];
};

export const joinedDashboardKeys = {
  all: (address: string) => ["home", "joined-dashboard", address] as const,
};

async function fetchJoinedDashboard(address: string): Promise<JoinedDashboardCampaign[]> {
  const res = await fetch(
    `/api/community/campaigns/joined-dashboard?address=${encodeURIComponent(address)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to load joined campaigns");
  return json.campaigns ?? [];
}

export function useJoinedCampaignDashboard(address: string | undefined) {
  return useQuery({
    queryKey: joinedDashboardKeys.all(address ?? ""),
    queryFn: () => fetchJoinedDashboard(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
  });
}
