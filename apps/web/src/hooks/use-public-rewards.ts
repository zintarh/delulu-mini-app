"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicRewardsDto } from "@/app/api/rewards/public/route";

/** Live reward amounts + public payout stats (no sign-in needed). */
export function usePublicRewards() {
  return useQuery<PublicRewardsDto>({
    queryKey: ["rewards-public"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/rewards/public");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}
