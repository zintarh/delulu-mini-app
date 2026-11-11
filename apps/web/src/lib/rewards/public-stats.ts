/**
 * "We're real" numbers for the How to earn page, from actual payout records:
 * team grants (incl. monthly top-performer rewards), referral payouts, Rewards
 * Engine payouts and the old per-proof rewards. Aggregates only — no wallets
 * leave the server. Pure, so it's unit-tested (public-stats.test.ts).
 */

export type PayoutRecord = { wallet: string; amount: number; token: "G$" | "USDT" };

export type PublicRewardStats = {
  /** All G$ paid out. */
  totalG: number;
  /** Stablecoin rewards paid (USDT), in dollars. */
  totalUsd: number;
  /** Distinct people who received any reward. */
  people: number;
  /** Largest single G$ payout. */
  biggestG: number;
};

export function aggregatePayouts(records: PayoutRecord[]): PublicRewardStats {
  const people = new Set<string>();
  let totalG = 0;
  let totalUsd = 0;
  let biggestG = 0;
  for (const r of records) {
    if (!r.wallet || !(r.amount > 0) || !Number.isFinite(r.amount)) continue;
    people.add(r.wallet.toLowerCase());
    if (r.token === "USDT") {
      totalUsd += r.amount;
    } else {
      totalG += r.amount;
      biggestG = Math.max(biggestG, r.amount);
    }
  }
  return { totalG, totalUsd, people: people.size, biggestG };
}

/** "2M", "85K", "1.3M" — big round numbers read better as social proof. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
