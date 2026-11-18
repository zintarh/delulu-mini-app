"use client";

import { useQuery } from "@tanstack/react-query";
import type { EarnFacts } from "@/lib/earn/format";

/** Live "what's at stake" numbers ($ and ₦) — public, cached 15 min. */
export function useEarnFacts(): EarnFacts | undefined {
  return useQuery({
    queryKey: ["earn-facts"],
    staleTime: 15 * 60_000,
    queryFn: async (): Promise<EarnFacts> => {
      const res = await fetch("/api/earn/facts");
      if (!res.ok) throw new Error("earn facts unavailable");
      return res.json();
    },
  }).data;
}
