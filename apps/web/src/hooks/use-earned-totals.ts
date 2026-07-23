"use client";

import { useEffect, useMemo, useState } from "react";
import { useClaimsTotalsByAddresses } from "@/hooks/graph/useClaimsTotalsByAddresses";

async function fetchProfileClaimedGd(
  addresses: string[],
): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  const params = new URLSearchParams({ addresses: addresses.join(",") });
  const res = await fetch(`/api/profile/claim?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { totals?: Record<string, number> };
  const totals: Record<string, number> = {};
  for (const [addr, amount] of Object.entries(data.totals ?? {})) {
    const n = Number(amount);
    totals[addr.toLowerCase()] = Number.isFinite(n) ? n : 0;
  }
  return totals;
}

/**
 * Earned G$ = on-chain delulu reward claims (subgraph / wallet activity)
 *          + G$ claimed through the app (profiles.total_claimed_gd).
 */
export function useEarnedTotalsByAddresses(addresses: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))).sort(),
    [addresses],
  );
  const idsKey = ids.join(",");

  const { totalsByAddress: subgraphTotals, isLoading: subgraphLoading } =
    useClaimsTotalsByAddresses(ids);

  const [profileTotals, setProfileTotals] = useState<Record<string, number>>({});
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (ids.length === 0) {
      setProfileTotals({});
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchProfileClaimedGd(ids)
      .then((totals) => {
        if (!cancelled) setProfileTotals(totals);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey, ids]);

  const totalsByAddress = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of ids) {
      map[id] = (subgraphTotals[id] ?? 0) + (profileTotals[id] ?? 0);
    }
    // Include any extra keys from either source (defensive).
    for (const [id, amount] of Object.entries(subgraphTotals)) {
      if (map[id] == null) map[id] = amount + (profileTotals[id] ?? 0);
    }
    for (const [id, amount] of Object.entries(profileTotals)) {
      if (map[id] == null) map[id] = amount + (subgraphTotals[id] ?? 0);
    }
    return map;
  }, [ids, subgraphTotals, profileTotals]);

  return {
    totalsByAddress,
    isLoading: subgraphLoading || profileLoading,
  };
}

/** Single-wallet earned total for wallet / home / settings. */
export function useUserEarnedTotal(address: string | undefined) {
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const { totalsByAddress, isLoading } = useEarnedTotalsByAddresses(addresses);
  const totalEarned = address
    ? (totalsByAddress[address.toLowerCase()] ?? 0)
    : 0;
  return { totalEarned, isLoading };
}
