"use client";

import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

export type AppEarnedKind = "ubi" | "reward";

/**
 * Fire-and-forget: record an app receipt toward profiles.total_earned_usdt.
 * Server converts token amount → USDT (skips CELO).
 */
export function recordAppEarned(input: {
  address: string | undefined | null;
  amount: number;
  tokenAddress?: string | null;
  kind?: AppEarnedKind;
}): void {
  const address = input.address?.toLowerCase();
  if (!address || !Number.isFinite(input.amount) || input.amount <= 0) return;

  void fetch("/api/profile/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      address,
      amount: input.amount,
      tokenAddress: input.tokenAddress ?? GOODDOLLAR_ADDRESSES.mainnet,
      kind: input.kind ?? "reward",
    }),
  }).catch(() => {});
}
