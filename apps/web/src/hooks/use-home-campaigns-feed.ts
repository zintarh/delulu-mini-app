"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommunityCampaignFeedItem,
  HomeCampaignFeedSection,
} from "@/lib/community/campaign-types";

export type HomeCampaignsFeedSort = "participants" | "recent";

export const homeCampaignKeys = {
  feed: (
    section: HomeCampaignFeedSection,
    address: string,
    sort: HomeCampaignsFeedSort = "participants",
  ) => ["home", "campaigns", section, address, sort] as const,
};

async function fetchFeedPage(
  section: HomeCampaignFeedSection,
  address: string,
  sort: HomeCampaignsFeedSort,
  cursor?: string,
): Promise<{ campaigns: CommunityCampaignFeedItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    address,
    section,
    sort,
    limit: "6",
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
  sort: HomeCampaignsFeedSort = "participants",
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["home", "campaigns"] });
    };
    window.addEventListener("delulu:campaign-deleted", invalidate);
    window.addEventListener("delulu:campaign-created", invalidate);
    return () => {
      window.removeEventListener("delulu:campaign-deleted", invalidate);
      window.removeEventListener("delulu:campaign-created", invalidate);
    };
  }, [queryClient]);

  return useInfiniteQuery({
    queryKey: homeCampaignKeys.feed(section, address ?? "", sort),
    queryFn: ({ pageParam }) =>
      fetchFeedPage(section, address!, sort, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(address),
    staleTime: 60 * 1000,
    refetchOnMount: true,
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
