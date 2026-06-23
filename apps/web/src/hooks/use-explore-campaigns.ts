"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { CampaignExploreCardData } from "@/components/community/campaign-explore-card";

export const exploreCampaignKeys = {
  active: (address?: string) => ["explore", "campaigns", "active", address ?? ""] as const,
  all: ["explore", "campaigns"] as const,
};

async function fetchActivePage(
  address?: string,
  cursor?: string,
): Promise<{ campaigns: CampaignExploreCardData[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  if (address) params.set("address", address);

  const res = await fetch(`/api/community/campaigns/active?${params}`);
  if (!res.ok) throw new Error("Failed to load campaigns");
  return res.json();
}

export function useExploreCampaigns(address?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onDeleted = () => {
      void queryClient.invalidateQueries({ queryKey: exploreCampaignKeys.all });
    };
    window.addEventListener("delulu:campaign-deleted", onDeleted);
    return () => window.removeEventListener("delulu:campaign-deleted", onDeleted);
  }, [queryClient]);

  return useInfiniteQuery({
    queryKey: exploreCampaignKeys.active(address),
    queryFn: ({ pageParam }) => fetchActivePage(address, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60 * 1000,
    refetchOnMount: true,
  });
}
