"use client";

import { useQuery } from "@tanstack/react-query";
import { stakeRulesView, type StakeRulesView } from "@/lib/season/rules";

/** Rules for an unknown wallet — used until the real ones load, so nothing flickers open then shut. */
const FALLBACK: StakeRulesView = stakeRulesView({ firstSeenMs: null, acceptedProofs: 0, activeDays: 0 });

/** This wallet's Season 2 minimum stake, tier and caps. */
export function useStakeRules(address: string | null | undefined) {
  const q = useQuery({
    queryKey: ["stake-rules", address?.toLowerCase() ?? null],
    enabled: !!address,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StakeRulesView> => {
      const res = await fetch(`/api/season/stake-rules?address=${address}`);
      if (!res.ok) throw new Error("stake rules unavailable");
      return res.json();
    },
  });
  return { rules: q.data ?? FALLBACK, loading: q.isLoading && !!address };
}
