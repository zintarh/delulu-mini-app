"use client";

import { useEffect, useState } from "react";

export type AdminRewardGrant = {
  id: string;
  amount: number;
  tokenSymbol: string;
  tokenAddress: string;
  reason: string | null;
  txHash: string;
  createdAt: string;
};

/** Team rewards deposited to this wallet (from admin_reward_grants). */
export function useAdminRewardGrants(address: `0x${string}` | undefined) {
  const [grants, setGrants] = useState<AdminRewardGrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setGrants([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetch(`/api/rewards/grants?address=${encodeURIComponent(address)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          grants?: AdminRewardGrant[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load rewards");
        if (!cancelled) setGrants(json.grants ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load rewards");
          setGrants([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { grants, isLoading, error };
}
