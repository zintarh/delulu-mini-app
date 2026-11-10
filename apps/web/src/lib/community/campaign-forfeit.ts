/**
 * What a missed milestone costs in a paid campaign — the single source for
 * every user-facing forfeit line, so Home, the campaign page, the join modal
 * and Rewards all say the same thing.
 *
 * Mirrors CommunityMarketV1.claimCommunityJoinStake: each missed milestone
 * forfeits `forfeitPct`% of the ORIGINAL stake (not compounding), capped at
 * the whole stake. Forfeits go to Delulu; users are told "the Delulu pool".
 * The percentage is whatever the admin set on the campaign — never assume 5%.
 */

export type ForfeitTerms = {
  stake: number;
  token: string;
  pct: number;
  /** Stake lost per missed milestone. */
  perMiss: number;
  /** Misses that wipe the whole stake, or null if the campaign is too short to. */
  missesToLoseAll: number | null;
  /** Worst case over the whole campaign (capped at the stake). */
  maxLoss: number;
};

export type ForfeitSource = {
  isFreeToJoin?: boolean | null;
  joinAmount?: number | null;
  forfeitPct?: number | null;
  joinToken?: string | null;
  milestoneCount?: number | null;
};

/** Null when there's nothing to lose (free join, no stake, or 0%). */
export function getForfeitTerms(c: ForfeitSource): ForfeitTerms | null {
  const stake = Number(c.joinAmount ?? 0);
  const pct = Number(c.forfeitPct ?? 0);
  if (c.isFreeToJoin !== false || !(stake > 0) || !(pct > 0)) return null;
  const milestones = Math.max(0, Number(c.milestoneCount ?? 0));
  const perMiss = (stake * pct) / 100;
  const allGoneAt = Math.ceil(100 / pct);
  return {
    stake,
    token: c.joinToken || "G$",
    pct,
    perMiss,
    missesToLoseAll: milestones === 0 || allGoneAt <= milestones ? allGoneAt : null,
    maxLoss: milestones > 0 ? Math.min(stake, perMiss * milestones) : stake,
  };
}

/** Lost so far and what's left, for someone who has missed `missed` milestones. */
export function forfeitProgress(t: ForfeitTerms, missed: number) {
  const lost = Math.min(t.stake, t.perMiss * Math.max(0, missed));
  return { lost, left: t.stake - lost };
}

/** 1000 → "1,000"; keeps up to 2 decimals for small stakes (e.g. 2% of 50). */
export function formatStake(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 });
}

/** 20000 → "20K", 1500 → "1.5K" — for big card numbers. */
export function compactStake(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return formatStake(n);
}

/** "Miss a milestone, lose 5% (1,000 G$) to the Delulu pool" */
export function forfeitRuleLine(t: ForfeitTerms): string {
  return `Miss a milestone, lose ${t.pct}% (${formatStake(t.perMiss)} ${t.token}) to the Delulu pool`;
}
