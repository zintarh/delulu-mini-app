"use client";

import { useEffect, useMemo, useState } from "react";

async function fetchProfileEarnedUsdt(
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
 * Earned = USDT-equivalent of everything received via the app
 * (UBI + delulu rewards in G$/USDT/cUSD/…; CELO excluded).
 * Stored on profiles.total_earned_usdt at claim time.
 */
export function useEarnedTotalsByAddresses(addresses: string[]) {
  const ids = useMemo(
    () => Array.from(new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))).sort(),
    [addresses],
  );
  const idsKey = ids.join(",");

  const [totalsByAddress, setTotalsByAddress] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (ids.length === 0) {
      setTotalsByAddress({});
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchProfileEarnedUsdt(ids)
      .then((totals) => {
        if (!cancelled) setTotalsByAddress(totals);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey, ids]);

  return { totalsByAddress, isLoading };
}

/** Single-wallet earned total (USDT) for wallet / home / settings. */
export function useUserEarnedTotal(address: string | undefined) {
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const { totalsByAddress, isLoading } = useEarnedTotalsByAddresses(addresses);
  const totalEarned = address
    ? (totalsByAddress[address.toLowerCase()] ?? 0)
    : 0;
  return { totalEarned, isLoading };
}

/** Format earned USDT for compact UI (e.g. leaderboard). */
export function formatEarnedUsdt(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0";
  if (amount >= 1000) {
    return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
