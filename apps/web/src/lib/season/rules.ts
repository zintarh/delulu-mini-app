/**
 * Season 2 — "stake to play". Pure rules shared by the client gates, the
 * server gates and the Season 2 leaderboard.
 *
 * From SEASON_2_START:
 *  - Everyone stakes at least 5k G$ to start a Forfeit goal, join a campaign or
 *    play a Bingo. The one 1k way in is "Your First Week" (lib/bingo/first-week),
 *    which pays enough (+ the stake back) to cover a 5k stake afterwards.
 *  - Newcomers (first 2 weeks, ≤ 20 proofs, ≤ 20 active days) can still make
 *    word pledges; regulars can't.
 *  - Nothing new runs longer than 7 days.
 *  - Points per verified proof scale with the stake behind it; under 5k is
 *    a token amount. Season 2 points count from SEASON_2_POINTS_START (Sat
 *    21 Nov, two days before the stake rules); everything earlier is archived
 *    as Season 1 (all-time points stay).
 */

/** Monday 23 Nov 2026, 00:00 WAT (UTC+1). */
export const SEASON_2_START_MS = Date.UTC(2026, 10, 22, 23, 0, 0);
export const SEASON_2_START_LABEL = "Monday 23 Nov";

/** Season 2 points (stake ÷ 10, the new board) count from Saturday 21 Nov, 00:00 WAT — before the stake rules. */
export const SEASON_2_POINTS_START_MS = Date.UTC(2026, 10, 20, 23, 0, 0);

export function isSeason2PointsLive(now: number = Date.now()): boolean {
  return now >= SEASON_2_POINTS_START_MS;
}

export const NEWCOMER_WINDOW_DAYS = 14;
export const VETERAN_PROOF_COUNT = 20;
export const VETERAN_ACTIVE_DAYS = 20;

/**
 * Minimum money stake (25 Nov 2026: sized to the free daily claim, ~120 G$/day —
 * was 5,000). First Week (100) and 3-day Bingos (from 500) are exempt.
 */
export const NEWCOMER_MIN_STAKE = 1_000;
export const REGULAR_MIN_STAKE = 1_000;
export const MAX_GOAL_DAYS = 7;

/** Points per verified proof: stake ÷ 10 from the minimum stake up, capped at a 100k stake. */
export const POINTS_PER_STAKE_DIVISOR = 10;
export const POINTS_STAKE_CAP = 100_000;
/** Token points for proofs backed by less than the minimum stake (word pledges, free campaigns included). */
export const LOW_STAKE_POINTS = 10;

/** Stake presets shown to regulars — the points they earn sit right under them. */
export const STAKE_PRESETS_REGULAR = [1_000, 2_500, 5_000] as const;
export const STAKE_PRESETS_NEWCOMER = STAKE_PRESETS_REGULAR;

const DAY_MS = 86_400_000;

export function isSeason2Live(now: number = Date.now()): boolean {
  return now >= SEASON_2_START_MS;
}

export type StakeTier = "newcomer" | "regular";

export type StakeActivity = {
  /** When the wallet first showed up (profile created). null = never seen → newcomer. */
  firstSeenMs: number | null;
  acceptedProofs: number;
  activeDays: number;
};

export function stakeTierFor(a: StakeActivity, now: number = Date.now()): StakeTier {
  if (a.acceptedProofs > VETERAN_PROOF_COUNT || a.activeDays > VETERAN_ACTIVE_DAYS) return "regular";
  if (a.firstSeenMs != null && now - a.firstSeenMs >= NEWCOMER_WINDOW_DAYS * DAY_MS) return "regular";
  return "newcomer";
}

/** When the newcomer minimum ends (null when it already has, or the wallet is new). */
export function newcomerEndsAt(a: StakeActivity, now: number = Date.now()): number | null {
  if (stakeTierFor(a, now) !== "newcomer") return null;
  return (a.firstSeenMs ?? now) + NEWCOMER_WINDOW_DAYS * DAY_MS;
}

/** Minimum G$ stake for this wallet. Before the season starts, the old floor applies (0 = no gate). */
export function minStakeFor(tier: StakeTier, now: number = Date.now()): number {
  if (!isSeason2Live(now)) return 0;
  return tier === "regular" ? REGULAR_MIN_STAKE : NEWCOMER_MIN_STAKE;
}

/** Word pledges (no money) are newcomer-only once the season is live. */
export function canPledgeWord(tier: StakeTier, now: number = Date.now()): boolean {
  return !isSeason2Live(now) || tier === "newcomer";
}

/** Season 2 points for one verified proof backed by `stakeWhole` G$. */
export function seasonPointsForStake(stakeWhole: number): number {
  if (!Number.isFinite(stakeWhole) || stakeWhole < REGULAR_MIN_STAKE) return LOW_STAKE_POINTS;
  return Math.floor(Math.min(stakeWhole, POINTS_STAKE_CAP) / POINTS_PER_STAKE_DIVISOR);
}

/** Latest allowed end for a new goal created at `now` (7 days, end of that day handled by callers). */
export function maxGoalEndMs(now: number = Date.now()): number {
  return now + MAX_GOAL_DAYS * DAY_MS;
}

/** Whether a goal/campaign of `durationDays` is allowed under the 7-day cap. */
export function isDurationAllowed(durationDays: number, now: number = Date.now()): boolean {
  if (!isSeason2Live(now)) return true;
  return durationDays <= MAX_GOAL_DAYS;
}

export type StakeRulesView = {
  live: boolean;
  startsAt: number;
  tier: StakeTier;
  minStake: number;
  canPledgeWord: boolean;
  newcomerEndsAt: number | null;
  maxDays: number;
};

export function stakeRulesView(a: StakeActivity, now: number = Date.now()): StakeRulesView {
  const tier = stakeTierFor(a, now);
  return {
    live: isSeason2Live(now),
    startsAt: SEASON_2_START_MS,
    tier,
    minStake: minStakeFor(tier, now),
    canPledgeWord: canPledgeWord(tier, now),
    newcomerEndsAt: newcomerEndsAt(a, now),
    maxDays: MAX_GOAL_DAYS,
  };
}
