/**
 * Cheers: send G$ to someone's Bingo card. Each cheer is a vote in that
 * Bingo's weekly "Best card" contest; the money goes to the card's owner.
 * Pure — shared by the API and the UI, unit-tested.
 */
import { currentReferralRound, nextReferralRound } from "@/lib/referral/campaign";

export const CHEER_AMOUNTS = [100, 500, 1_000] as const;
export const MIN_CHEER_G = 100;
/** The best card each week, per Bingo. */
export const BEST_CARD_PRIZE_G = 10_000;
/** A Bingo needs this many players that week for its contest to run. */
export const CONTEST_MIN_PLAYERS = 5;
export const LEADERBOARD_SIZE = 10;

/** The contest week: the same Tuesday-to-Tuesday weeks as referral rounds. */
export function contestWeek(nowMs = Date.now()): { start: string; end: string } | null {
  const r = currentReferralRound(new Date(nowMs));
  return r ? { start: r.start, end: r.end } : null;
}
export const nextContestStart = (nowMs = Date.now()) => nextReferralRound(new Date(nowMs))?.start ?? null;

/** Lagos calendar day "YYYY-MM-DD". */
export const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

export type CheerRow = { attemptId: string; fromWallet: string; amount: number };
export type CardScore = { attemptId: string; score: number; cheers: number; voters: number; totalG: number };

/**
 * Score = Σ over voters of √(that voter's G$ to this card ÷ 100). Ten people
 * cheering 100 G$ (10 points) beat one person cheering 5,000 G$ (≈7 points):
 * a card wins on how many people back it, not one big wallet.
 */
export function scoreCards(rows: readonly CheerRow[]): CardScore[] {
  const byCard = new Map<string, Map<string, { g: number; n: number }>>();
  for (const r of rows) {
    const voters = byCard.get(r.attemptId) ?? new Map();
    const v = voters.get(r.fromWallet) ?? { g: 0, n: 0 };
    v.g += r.amount;
    v.n += 1;
    voters.set(r.fromWallet, v);
    byCard.set(r.attemptId, voters);
  }
  return [...byCard.entries()]
    .map(([attemptId, voters]) => {
      let score = 0;
      let cheers = 0;
      let totalG = 0;
      for (const v of voters.values()) {
        score += Math.sqrt(v.g / MIN_CHEER_G);
        cheers += v.n;
        totalG += v.g;
      }
      return { attemptId, score: Math.round(score * 10) / 10, cheers, voters: voters.size, totalG };
    })
    .sort((a, b) => b.score - a.score || b.voters - a.voters);
}
