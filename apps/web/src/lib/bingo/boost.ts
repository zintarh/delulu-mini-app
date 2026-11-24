/**
 * Daily Boost — client-safe rules, shared by the server (cashback, recording)
 * and the app (meter, Claim & boost).
 *
 * Before a day's photo, the player can add G$ to their card's stake (on-chain:
 * ForfeitMarket.boostCommitment). Boosts follow the stake's rules — back on
 * finishing, lost on a miss. Finishing pays cashback on the whole pot:
 * BASE_PCT, plus STEP_PCT for every day they boosted AND kept, up to MAX_PCT.
 *
 * Fairness rules:
 *  - Only boosts before that day's photo count (the contract refuses once the
 *    day is resolved; the server only records what the contract accepted).
 *  - A day's boost counts toward the pot up to dailyBoostCap(); more is still
 *    returned on finishing, it just earns no cashback.
 *  - A boosted day adds to the % only if that day's photo was kept.
 *
 * `live` is the switch: off until the contract upgrade with boostCommitment is
 * on mainnet (docs/drafts/daily-boost). With it off nothing changes anywhere.
 */
import { parseAbi } from "viem";

/** ForfeitMarket's Daily Boost surface (the v4 upgrade, docs/drafts/daily-boost). */
export const BOOST_ABI = parseAbi([
  "function boostCommitment(uint256 commitmentId, uint256 amount)",
  "function boostedAmount(uint256 commitmentId, uint32 periodIndex) view returns (uint256)",
  "event CommitmentBoosted(uint256 indexed commitmentId, uint32 indexed periodIndex, address indexed creator, uint256 amount, uint256 newStakeAmount)",
]);

export const BOOST = {
  live: process.env.NEXT_PUBLIC_DAILY_BOOST === "1",
  basePct: 10,
  stepPct: 1,
  maxPct: 17,
} as const;

/** The most of one day's boost that earns cashback: today's free claim or half the card's starting stake, whichever is bigger. */
export function dailyBoostCap(startStake: number, todaysClaim: number | null | undefined): number {
  return Math.max(Math.floor(startStake / 2), Math.floor(todaysClaim ?? 0));
}

export type BoostDay = { slot: number; amount: number };

export type BoostSummary = {
  /** Starting stake + every day's boost (what comes back on finishing). */
  pot: number;
  /** Starting stake + each day's boost up to the cap (what cashback is paid on). */
  countedPot: number;
  /** Days boosted whose photo was kept. */
  boostedKeptDays: number;
  /** Cashback % on the counted pot. */
  pct: number;
  cashback: number;
  /** Every day of the card boosted and kept so far — the "17% club" once the card is done. */
  perfect: boolean;
};

/** Pure: what a card's boosts are worth so far. `keptSlots` = days whose photo was kept. */
export function boostSummary(input: {
  startStake: number;
  boosts: BoostDay[];
  keptSlots: Iterable<number>;
  /** Free claim per day isn't known historically, so the cap uses the stake half only. */
  capPerDay?: number;
  days: number;
}): BoostSummary {
  const cap = input.capPerDay ?? dailyBoostCap(input.startStake, 0);
  const kept = new Set(input.keptSlots);
  const bySlot = new Map<number, number>();
  for (const b of input.boosts) bySlot.set(b.slot, (bySlot.get(b.slot) ?? 0) + b.amount);
  let pot = input.startStake;
  let countedPot = input.startStake;
  let boostedKeptDays = 0;
  for (const [slot, amount] of bySlot) {
    pot += amount;
    countedPot += Math.min(amount, cap);
    if (kept.has(slot) && amount > 0) boostedKeptDays++;
  }
  const pct = Math.min(BOOST.maxPct, BOOST.basePct + BOOST.stepPct * boostedKeptDays);
  return {
    pot,
    countedPot,
    boostedKeptDays,
    pct,
    cashback: Math.floor((countedPot * pct) / 100),
    perfect: input.days > 0 && boostedKeptDays >= input.days,
  };
}
