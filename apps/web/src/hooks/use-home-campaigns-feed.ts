"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  CommunityCampaignFeedItem,
  HomeCampaignFeedSection,
} from "@/lib/community/campaign-types";

export const homeCampaignKeys = {
  feed: (section: HomeCampaignFeedSection, address: string) =>
    ["home", "campaigns", section, address] as const,
};

async function fetchFeedPage(
  section: HomeCampaignFeedSection,
  address: string,
  cursor?: string,
): Promise<{ campaigns: CommunityCampaignFeedItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    address,
    section,
    limit: section === "ongoing" ? "3" : "4",
  });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`/api/community/campaigns/feed?${params}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to load campaigns");
  return {
    campaigns: json.campaigns ?? [],
    nextCursor: json.nextCursor ?? null,
  };
}

export function useHomeCampaignsFeed(
  section: HomeCampaignFeedSection,
  address: string | undefined,
) {
  return useInfiniteQuery({
    queryKey: homeCampaignKeys.feed(section, address ?? ""),
    queryFn: ({ pageParam }) => fetchFeedPage(section, address!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(address),
    staleTime: 30_000,
  });
}

export async function joinCommunityCampaign(campaignId: string, walletAddress: string) {
  const res = await fetch(`/api/community/campaigns/${campaignId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? "Join failed");
  }
  return json as {
    ok: boolean;
    alreadyJoined?: boolean;
    joinedCommunity: boolean;
    joinedCampaign?: boolean;
    requiresOnChain?: boolean;
    challengeId?: number;
  };
}
