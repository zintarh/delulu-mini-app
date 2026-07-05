"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { CampaignExploreCardData } from "@/components/community/campaign-explore-card";

export type ExploreCampaignsSort = "participants" | "recent";

export const exploreCampaignKeys = {
  active: (address?: string, sort: ExploreCampaignsSort = "participants") =>
    ["explore", "campaigns", "active", address ?? "", sort] as const,
  all: ["explore", "campaigns"] as const,
};

async function fetchActivePage(
  address?: string,
  sort: ExploreCampaignsSort = "participants",
  cursor?: string,
): Promise<{ campaigns: CampaignExploreCardData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: "20", sort });
  if (cursor) params.set("cursor", cursor);
  if (address) params.set("address", address);

  const res = await fetch(`/api/community/campaigns/active?${params}`);
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json();
}

export function useExploreCampaigns(
  address?: string,
  sort: ExploreCampaignsSort = "participants",
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: exploreCampaignKeys.all });
    };
    window.addEventListener("delulu:campaign-deleted", invalidate);
    window.addEventListener("delulu:campaign-created", invalidate);
    return () => {
      window.removeEventListener("delulu:campaign-deleted", invalidate);
      window.removeEventListener("delulu:campaign-created", invalidate);
    };
  }, [queryClient]);

  return useInfiniteQuery({
    queryKey: exploreCampaignKeys.active(address, sort),
    queryFn: ({ pageParam }) => fetchActivePage(address, sort, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });
}
