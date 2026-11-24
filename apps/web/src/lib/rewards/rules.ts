/**
 * Delulu G$ Rewards Engine — pure rules. No I/O, no "@/" imports, so the
 * whole file is unit-testable with `node --test` (see rules.test.ts).
 *
 * Categories:
 *  - daily_proof          one per eligible goal per reward day, at most
 *                         `dailyProof.maxEligibleGoals` goals per user
 *  - weekly_consistency   once per user per Mon–Sun week, after a streak of
 *                         `weeklyConsistency.minProofs` days in a row with a
 *                         daily-rewarded proof; a missed day resets it
 *  - campaign_completion  once per successfully completed campaign, amount
 *                         by the campaign's length (tiers); late joiners get
 *                         a reduced share
 *  - goal_completion      once per completed Forfeit goal, amount by the
 *                         goal's length, scaled by how much of it the goal
 *                         spent in one of the user's earning slots
 *  - streak_milestone     once per milestone per streak: N days in a row,
 *                         each with a daily-rewarded proof. Any number of
 *                         goals or proofs in a day is still one day; a missed
 *                         day ends the streak and its milestones start over
 */

export type RewardCategory =
  | "daily_proof"
  | "weekly_consistency"
  | "campaign_completion"
  | "goal_completion"
  | "streak_milestone";
export type GoalKind = "campaign" | "forfeit";

export type CompletionTier = { minDays: number; amount: number };

export type RewardsConfig = {
  /** Kill switch: false records nothing and pays nothing. */
  enabled: boolean;
  /** Calendar used for "today" and "this week" — most users are in Nigeria. */
  timezone: string;
  dailyProof: {
    /** Category switch. Off = no new rewards in this category; ones already granted still pay. */
    enabled: boolean;
    amount: number;
    /** Goals per user that can earn daily proof rewards at the same time. */
    maxEligibleGoals: number;
    /** @deprecated No longer used: a missed or left goal frees its slot at once (decideSlotRelease). Kept so saved configs still parse. */
    abandonCooldownDays: number;
    /** A slotted goal with no rewarded proof for this long is treated as abandoned. */
    idleReleaseDays: number;
  };
  weeklyConsistency: {
    enabled: boolean;
    amount: number;
    /**
     * Days in a row (each with a daily-rewarded proof) needed within one
     * Mon–Sun week. A missed day breaks the streak and it restarts from 0.
     * 1..7. (Named minProofs for stored-config compatibility.)
     */
    minProofs: number;
  };
  campaignCompletion: {
    enabled: boolean;
    /** Highest `minDays` the campaign's duration reaches wins. */
    tiers: CompletionTier[];
    /**
     * Late joiners earn tier × share^exponent, where share = milestones still
     * open when they joined / all milestones. 1 = proportional; 2 (default)
     * falls off fast: joining halfway earns 25%.
     */
    lateJoinExponent: number;
  };
  goalCompletion: {
    enabled: boolean;
    /** By the goal's total length in days. Empty list = no goal completion bonus. */
    tiers: CompletionTier[];
    /**
     * Earns tier × share^exponent, where share = the goal's daily-rewarded
     * proofs / its total periods — i.e. how much of it ran in one of the
     * user's earning slots. Finishing many goals at once can't multiply it.
     */
    shareExponent: number;
  };
  streakMilestones: {
    enabled: boolean;
    /**
     * `minDays` = streak length (days in a row) that pays `amount`, once per
     * streak. Joining late doesn't matter: 30 days in a row is 30 days
     * whenever it starts. Empty list = no streak bonuses.
     */
    tiers: CompletionTier[];
  };
  limits: {
    /**
     * Platform-wide G$ the engine may send per UTC day (same day as the
     * vault's own on-chain cap); 0 = no limit. Rewards over it stay pending
     * and go out the next day — nothing is dropped.
     */
    dailyBudget: number;
  };
};

const DEFAULT_COMPLETION_TIERS: CompletionTier[] = [
  { minDays: 90, amount: 5000 },
  { minDays: 30, amount: 1000 },
  { minDays: 7, amount: 500 },
];

export const DEFAULT_REWARDS_CONFIG: RewardsConfig = {
  enabled: true,
  timezone: "Africa/Lagos",
  dailyProof: { enabled: true, amount: 100, maxEligibleGoals: 2, abandonCooldownDays: 0, idleReleaseDays: 14 },
  weeklyConsistency: { enabled: true, amount: 250, minProofs: 5 },
  campaignCompletion: { enabled: true, tiers: DEFAULT_COMPLETION_TIERS, lateJoinExponent: 2 },
  goalCompletion: { enabled: true, tiers: DEFAULT_COMPLETION_TIERS, shareExponent: 2 },
  streakMilestones: {
    enabled: true,
    tiers: [
      { minDays: 90, amount: 5000 },
      { minDays: 60, amount: 2500 },
      { minDays: 30, amount: 1000 },
      { minDays: 14, amount: 500 },
    ],
  },
  limits: { dailyBudget: 0 },
};

/** Whether the engine may grant new rewards in `category` right now. */
export function isCategoryEnabled(config: RewardsConfig, category: RewardCategory): boolean {
  if (!config.enabled) return false;
  switch (category) {
    case "daily_proof":
      return config.dailyProof.enabled;
    case "weekly_consistency":
      return config.weeklyConsistency.enabled;
    case "campaign_completion":
      return config.campaignCompletion.enabled;
    case "goal_completion":
      return config.goalCompletion.enabled;
    case "streak_milestone":
      return config.streakMilestones.enabled;
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function pickNumber(v: unknown, fallback: number, { min = 0, integer = false } = {}): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) return fallback;
  if (integer && !Number.isInteger(v)) return fallback;
  return v;
}

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Overlays a (possibly partial, possibly malformed) override — e.g. the
 * `reward_config` row — onto the defaults. Each invalid field falls back to
 * its default on its own, so one typo can't zero out every reward or turn
 * the goal cap off.
 */
export function resolveRewardsConfig(override: unknown, base: RewardsConfig = DEFAULT_REWARDS_CONFIG): RewardsConfig {
  if (!isPlainObject(override)) return base;
  const daily = isPlainObject(override.dailyProof) ? override.dailyProof : {};
  const weekly = isPlainObject(override.weeklyConsistency) ? override.weeklyConsistency : {};
  const completion = isPlainObject(override.campaignCompletion) ? override.campaignCompletion : {};
  const goal = isPlainObject(override.goalCompletion) ? override.goalCompletion : {};
  const streak = isPlainObject(override.streakMilestones) ? override.streakMilestones : {};
  const limits = isPlainObject(override.limits) ? override.limits : {};
  const pickBool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

  return {
    enabled: typeof override.enabled === "boolean" ? override.enabled : base.enabled,
    timezone: isValidTimezone(override.timezone) ? override.timezone : base.timezone,
    dailyProof: {
      enabled: pickBool(daily.enabled, base.dailyProof.enabled),
      amount: pickNumber(daily.amount, base.dailyProof.amount),
      maxEligibleGoals: pickNumber(daily.maxEligibleGoals, base.dailyProof.maxEligibleGoals, { integer: true }),
      abandonCooldownDays: pickNumber(daily.abandonCooldownDays, base.dailyProof.abandonCooldownDays, { integer: true }),
      idleReleaseDays: pickNumber(daily.idleReleaseDays, base.dailyProof.idleReleaseDays, { min: 1, integer: true }),
    },
    weeklyConsistency: {
      enabled: pickBool(weekly.enabled, base.weeklyConsistency.enabled),
      amount: pickNumber(weekly.amount, base.weeklyConsistency.amount),
      // Older configs counted proofs (up to 14); a streak can't exceed 7 days.
      minProofs: Math.min(7, pickNumber(weekly.minProofs, base.weeklyConsistency.minProofs, { min: 1, integer: true })),
    },
    campaignCompletion: {
      enabled: pickBool(completion.enabled, base.campaignCompletion.enabled),
      tiers: pickTiers(completion.tiers, base.campaignCompletion.tiers),
      lateJoinExponent: pickNumber(completion.lateJoinExponent, base.campaignCompletion.lateJoinExponent, { min: 1 }),
    },
    goalCompletion: {
      enabled: pickBool(goal.enabled, base.goalCompletion.enabled),
      tiers: pickTiers(goal.tiers, base.goalCompletion.tiers),
      shareExponent: pickNumber(goal.shareExponent, base.goalCompletion.shareExponent, { min: 1 }),
    },
    streakMilestones: {
      enabled: pickBool(streak.enabled, base.streakMilestones.enabled),
      tiers: pickTiers(streak.tiers, base.streakMilestones.tiers),
    },
    limits: {
      dailyBudget: pickNumber(limits.dailyBudget, base.limits.dailyBudget),
    },
  };
}

function pickTiers(v: unknown, fallback: CompletionTier[]): CompletionTier[] {
  let tiers = fallback;
  if (Array.isArray(v)) {
    const parsed = v.filter(
      (t): t is CompletionTier =>
        isPlainObject(t) &&
        typeof t.minDays === "number" && Number.isInteger(t.minDays) && t.minDays > 0 &&
        typeof t.amount === "number" && Number.isFinite(t.amount) && t.amount >= 0,
    );
    // An explicitly empty list switches the bonus off; a list where every
    // entry is malformed is a mistake, so keep the defaults.
    if (parsed.length > 0 || v.length === 0) tiers = parsed.map((t) => ({ minDays: t.minDays, amount: t.amount }));
  }
  return [...tiers].sort((a, b) => b.minDays - a.minDays);
}

/** tier × share^exponent, floored to whole G$. share 1 → the full tier. */
export function proratedCompletionAmount(fullAmount: number, share: number, exponent: number): number {
  if (!(fullAmount > 0) || !(share > 0)) return 0;
  const s = Math.min(1, share);
  return s >= 1 ? fullAmount : Math.floor(fullAmount * Math.pow(s, exponent));
}

/** Completion reward for a campaign of `durationDays`, or 0 if it's shorter than every tier. */
export function completionAmountFor(durationDays: number, tiers: CompletionTier[]): number {
  if (!Number.isFinite(durationDays) || durationDays <= 0) return 0;
  const tier = [...tiers].sort((a, b) => b.minDays - a.minDays).find((t) => durationDays >= t.minDays);
  return tier?.amount ?? 0;
}

// ── Calendar ────────────────────────────────────────────────────────────────

/** YYYY-MM-DD of `date` in `timeZone` — also exactly a Postgres date literal. */
export function rewardDayFor(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

function parseDay(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Invalid reward day: ${day}`);
  return new Date(`${day}T00:00:00Z`);
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}

/** Monday..Sunday (inclusive) of the week containing `day`. */
export function weekBounds(day: string): { start: string; end: string } {
  const d = parseDay(day);
  const offsetFromMonday = (d.getUTCDay() + 6) % 7;
  const start = addDays(day, -offsetFromMonday);
  return { start, end: addDays(start, 6) };
}

/** ISO-8601 week key, e.g. "2026-W46" (the week-year can differ from the calendar year at the edges). */
export function isoWeekKey(day: string): string {
  const d = parseDay(day);
  // Thursday of this ISO week decides which year the week belongs to.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const weekYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((thursday.getTime() - week1Monday.getTime() - 3 * 86_400_000) / (7 * 86_400_000));
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

/** Whole days from `fromDay` to `toDay` (negative if `toDay` is earlier). */
export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((parseDay(toDay).getTime() - parseDay(fromDay).getTime()) / 86_400_000);
}

// ── Weekly streak ───────────────────────────────────────────────────────────

/** Longest run of consecutive calendar days in `days` (duplicates ignored). */
export function longestDayRun(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export type WeeklyStreak = {
  /** Days in a row still alive: ends today, or yesterday (today isn't missed yet). */
  current: number;
  /** Best run this week — the bonus is earned once this reaches `needed`. */
  best: number;
  /** True when the week had progress but a day was missed since, so it reset to 0. */
  broken: boolean;
  /** False when the days left this week can't reach `needed` any more. */
  reachable: boolean;
};

/**
 * The weekly bonus streak for the Mon–Sun week containing `today`.
 * `days` are reward days with a daily-rewarded proof (any week; filtered here).
 */
export function weeklyStreak(days: string[], today: string, needed: number): WeeklyStreak {
  const { start, end } = weekBounds(today);
  const inWeek = [...new Set(days.filter((d) => d >= start && d <= end && d <= today))].sort();
  const best = longestDayRun(inWeek);
  const set = new Set(inWeek);

  const yesterday = addDays(today, -1);
  let cursor = set.has(today) ? today : yesterday;
  let current = 0;
  while (cursor >= start && set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const daysLeftAfterToday = daysBetween(today, end);
  const canStillAdd = daysLeftAfterToday + (set.has(today) ? 0 : 1);
  return {
    current,
    best,
    broken: current === 0 && inWeek.length > 0,
    reachable: best >= needed || current + canStillAdd >= needed,
  };
}

// ── Day streak (streak milestones, leaderboard flame) ───────────────────────

export type DayRun = { length: number; start: string | null };

/**
 * The run of consecutive days ending on `endDay` (or the day before, when
 * `allowYesterday` — today isn't missed until it's over). `days` may hold
 * duplicates and other dates. length 0 → no live streak.
 */
export function dayRunEndingAt(days: string[], endDay: string, allowYesterday = false): DayRun {
  const set = new Set(days);
  let cursor = set.has(endDay) ? endDay : allowYesterday ? addDays(endDay, -1) : endDay;
  let length = 0;
  let start: string | null = null;
  while (set.has(cursor)) {
    length++;
    start = cursor;
    cursor = addDays(cursor, -1);
  }
  return { length, start };
}

/** Longest milestone first is how tiers are stored; this returns them shortest first. */
export function streakTiersAscending(config: RewardsConfig): CompletionTier[] {
  return [...config.streakMilestones.tiers].filter((t) => t.amount > 0).sort((a, b) => a.minDays - b.minDays);
}

/** The next milestone above `length`, or null once every milestone is behind it. */
export function nextStreakMilestone(config: RewardsConfig, length: number): CompletionTier | null {
  return streakTiersAscending(config).find((t) => t.minDays > length) ?? null;
}

// ── Idempotency keys ────────────────────────────────────────────────────────
// One key per reward that may ever exist. It's unique in reward_payouts and
// also hashes into the on-chain rewardId, so the same reward can't be paid
// twice even if the DB row were lost.

export const goalKey = (kind: GoalKind, ref: string) => `${kind}:${ref}`;

export function dailyProofDedupeKey(wallet: string, kind: GoalKind, goalRef: string, day: string): string {
  return `daily_proof:${wallet.toLowerCase()}:${goalKey(kind, goalRef)}:${day}`;
}

export function weeklyConsistencyDedupeKey(wallet: string, weekKey: string): string {
  return `weekly_consistency:${wallet.toLowerCase()}:${weekKey}`;
}

/** One per milestone per streak — a streak is identified by the day it started. */
export function streakMilestoneDedupeKey(wallet: string, streakStart: string, minDays: number): string {
  return `streak_milestone:${wallet.toLowerCase()}:${streakStart}:${minDays}`;
}

export function campaignCompletionDedupeKey(wallet: string, campaignId: string): string {
  return `campaign_completion:${wallet.toLowerCase()}:${campaignId}`;
}

export function goalCompletionDedupeKey(wallet: string, commitmentId: string): string {
  return `goal_completion:${wallet.toLowerCase()}:${commitmentId}`;
}

// ── Goal slots ──────────────────────────────────────────────────────────────

/** Where a slotted goal stands now, as read from the DB / chain. */
export type GoalState = "active" | "completed" | "abandoned" | "unknown";

export type SlotReleaseDecision =
  | { release: false }
  | { release: true; reason: "completed" | "abandoned" | "idle"; cooldownUntilDay: string | null };

/**
 * Whether a held slot should be freed. Finishing, missing (forfeited) or
 * leaving a goal, or letting it go idle, frees it at once: a missed goal never
 * cuts a player off from earning (24 Nov 2026 — the old 7-day cooldown read as
 * "you can't claim anymore" and pushed people out). `cooldownUntilDay` stays
 * null; the column is kept so old rows still read.
 */
export function decideSlotRelease(params: {
  state: GoalState;
  /** Last day this slot earned a daily reward (or the day it was claimed). */
  lastActiveDay: string;
  today: string;
  config: RewardsConfig["dailyProof"];
}): SlotReleaseDecision {
  const { state, lastActiveDay, today, config } = params;
  if (state === "completed") return { release: true, reason: "completed", cooldownUntilDay: null };
  if (state === "abandoned") return { release: true, reason: "abandoned", cooldownUntilDay: null };
  if (daysBetween(lastActiveDay, today) >= config.idleReleaseDays) {
    return { release: true, reason: "idle", cooldownUntilDay: null };
  }
  return { release: false };
}

// ── Completion shares ───────────────────────────────────────────────────────

/**
 * Milestones a participant was there for: those whose deadline is after they
 * joined. Unknown join time (pre-upgrade joins) → all of them. Mirrors
 * CommunityMarketV1._missedMilestones, which never charges a late joiner
 * for milestones that closed before they joined.
 */
export function owedMilestoneIds(
  milestones: { id: number; deadlineSec: number }[],
  joinedAtSec: number | null,
): number[] {
  return milestones
    .filter((m) => joinedAtSec == null || joinedAtSec <= 0 || m.deadlineSec > joinedAtSec)
    .map((m) => m.id);
}
