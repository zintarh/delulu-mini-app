"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { SupportFeedDto } from "@/app/api/support/delulus/route";
import type { PublicDeluluDto } from "@/lib/support/server";

export type SupportSort = "trending" | "newest" | "most_supported" | "ending_soon";

export function useSupportFeed(params: { category: string | null; q: string; sort: SupportSort }) {
  return useInfiniteQuery<SupportFeedDto>({
    queryKey: ["support-feed", params.category ?? "all", params.q, params.sort],
    initialPageParam: 1,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      const sp = new URLSearchParams({ sort: params.sort, page: String(pageParam) });
      if (params.category) sp.set("category", params.category);
      if (params.q) sp.set("q", params.q);
      const res = await fetch(`/api/support/delulus?${sp}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export type SupportActivityItem = {
  id: string;
  supporter: { username: string | null; pfpUrl: string | null };
  amountG: number;
  at: string;
};

export type PublicDeluluDetailDto = PublicDeluluDto & {
  recent: SupportActivityItem[];
};

export function useSupportDelulu(id: string | number | null | undefined) {
  return useQuery<PublicDeluluDetailDto | null>({
    queryKey: ["support-delulu", String(id)],
    enabled: id != null,
    staleTime: 15_000,
    queryFn: async () => {
      const res = await fetch(`/api/support/delulus/${id}`, { credentials: "same-origin" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}
