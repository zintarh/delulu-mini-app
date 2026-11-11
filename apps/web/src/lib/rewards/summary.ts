/**
 * Pure aggregation behind the Rewards page (GET /api/rewards/summary). No
 * I/O and no "@/" imports, so the figures the page shows are unit-tested
 * against the same rules the engine pays by (summary.test.ts).
 */
import {
  completionAmountFor,
  isoWeekKey,
  proratedCompletionAmount,
  weekBounds,
  type RewardCategory,
  type RewardsConfig,
} from "./rules";

/** What the user sees: only 'confirmed' counts as earned. */
export type DisplayStatus = "pending" | "confirmed" | "failed";

export type HistoryInput = {
  id: string;
  category: RewardCategory;
  amount: number;
  /** reward_payouts.status, or a legacy proof_rewards status. */
  status: string;
  txHash: string | null;
  goalKind: "campaign" | "forfeit" | null;
  goalRef: string | null;
  periodKey: string | null;
  rewardDay: string | null;
  createdAt: string;
  confirmedAt: string | null;
  legacy: boolean;
};

export type HistoryItem = Omit<HistoryInput, "status"> & {
  status: DisplayStatus;
  goalTitle: string | null;
};

/** Engine and legacy statuses → what the page shows; null = not a reward (e.g. legacy 'capped'). */
export function displayStatus(status: string, legacy: boolean): DisplayStatus | null {
  if (legacy) {
    if (status === "sent") return "confirmed";
    if (status === "paying") return "pending";
    if (status === "failed") return "failed";
    return null;
  }
  if (status === "confirmed") return "confirmed";
  if (status === "failed") return "failed";
  if (status === "pending" || status === "processing" || status === "submitted") return "pending";
  return null;
}

export type RewardTotals = {
  /** Confirmed on-chain only. */
  earned: number;
  byCategory: Record<RewardCategory, number>;
  /** Granted, tx not confirmed yet. */
  pending: number;
  /** Errored; retried automatically — never counted as earned. */
  failed: number;
};

export function computeTotals(items: HistoryItem[]): RewardTotals {
  const totals: RewardTotals = {
    earned: 0,
    byCategory: { daily_proof: 0, weekly_consistency: 0, campaign_completion: 0, goal_completion: 0 },
    pending: 0,
    failed: 0,
  };
  for (const item of items) {
    if (item.status === "confirmed") {
      totals.earned += item.amount;
      totals.byCategory[item.category] += item.amount;
    } else if (item.status === "pending") {
      totals.pending += item.amount;
    } else {
      totals.failed += item.amount;
    }
  }
  return totals;
}

export type WeeklyProgress = {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  /** Daily-rewarded proofs this week — exactly what the engine counts. */
  proofs: number;
  needed: number;
  amount: number;
  /** This week's bonus, if already granted. */
  reward: { status: DisplayStatus; amount: number } | null;
};

/**
 * `engineDailyDays` are reward_day values of this user's engine daily-proof
 * rows (any status — the engine counts failed ones too, since they're
 * retried). Legacy 10 G$ rows don't count, as in the engine.
 */
export function computeWeeklyProgress(params: {
  today: string;
  engineDailyDays: string[];
  weeklyRewards: HistoryItem[];
  config: RewardsConfig;
}): WeeklyProgress {
  const { start, end } = weekBounds(params.today);
  const weekKey = isoWeekKey(params.today);
  const proofs = params.engineDailyDays.filter((d) => d >= start && d <= end).length;
  const reward = params.weeklyRewards.find((r) => r.periodKey === weekKey) ?? null;
  return {
    weekKey,
    weekStart: start,
    weekEnd: end,
    proofs,
    needed: params.config.weeklyConsistency.minProofs,
    amount: params.config.weeklyConsistency.amount,
    reward: reward ? { status: reward.status, amount: reward.amount } : null,
  };
}

export type CampaignInput = {
  campaignId: string;
  title: string;
  durationDays: number;
  /** 0 for off-chain (pre-launch) campaigns, which can't pay completion rewards. */
  challengeId: number;
  milestoneCount: number;
  completedCount: number;
  /** Closed-without-proof milestones, including ones that closed before joining. */
  overdueCount: number;
  /** Closed-without-proof milestones after joining — any > 0 rules out completion. */
  missedCount: number;
};

export type ProgressUnit = "days" | "weeks" | "steps";

/** What one milestone/period stands for, from the total length and count. */
export function progressUnit(durationDays: number, count: number): ProgressUnit {
  if (!(count > 0) || !(durationDays > 0)) return "steps";
  const per = durationDays / count;
  if (Math.abs(per - 1) < 0.15) return "days";
  if (Math.abs(per - 7) < 1) return "weeks";
  return "steps";
}

export type CompletionProgress = {
  kind: "campaign" | "forfeit";
  unit: ProgressUnit;
  ref: string;
  title: string;
  durationDays: number;
  /** campaign: milestones done · forfeit: daily-rewarded proofs */
  done: number;
  /** campaign: milestones open to this user · forfeit: total periods */
  needed: number;
  /** What finishing from here pays (already reduced for a late join / unslotted days), or the granted amount. */
  amount: number;
  /** The tier before any reduction. */
  fullAmount: number;
  /**
   * on_track   can still finish
   * missed     a milestone closed without proof — no completion bonus
   * completed  all done; the bonus follows once the last proof is verified
   * rewarded   bonus granted (see `reward`)
   */
  state: "on_track" | "missed" | "completed" | "rewarded";
  reward: { status: DisplayStatus; amount: number } | null;
};

const byCloseness = (a: CompletionProgress, b: CompletionProgress) =>
  Number(a.state === "missed") - Number(b.state === "missed") || b.done / b.needed - a.done / a.needed;

/**
 * Completion progress for joined campaigns that can pay a bonus (on-chain,
 * long enough for a tier). Matches the engine exactly: milestones that
 * closed before joining aren't owed but shrink the bonus (share^exponent);
 * one missed milestone after joining means no bonus.
 */
export function computeCampaignProgress(params: {
  campaigns: CampaignInput[];
  completionRewards: HistoryItem[];
  config: RewardsConfig;
}): CompletionProgress[] {
  const { config } = params;
  const rewardByCampaign = new Map(params.completionRewards.map((r) => [r.goalRef, r]));
  const out: CompletionProgress[] = [];
  for (const c of params.campaigns) {
    const reward = rewardByCampaign.get(c.campaignId) ?? null;
    const fullAmount = completionAmountFor(c.durationDays, config.campaignCompletion.tiers);
    if (!reward && (c.challengeId <= 0 || fullAmount <= 0 || c.milestoneCount <= 0)) continue;
    const beforeJoin = Math.max(0, c.overdueCount - c.missedCount);
    const needed = Math.max(0, c.milestoneCount - beforeJoin);
    const amount =
      reward?.amount ??
      proratedCompletionAmount(fullAmount, needed / c.milestoneCount, config.campaignCompletion.lateJoinExponent);
    if (!reward && (needed === 0 || amount <= 0)) continue;
    const done = Math.min(c.completedCount, needed);
    out.push({
      kind: "campaign",
      unit: progressUnit(c.durationDays, c.milestoneCount),
      ref: c.campaignId,
      title: c.title,
      durationDays: c.durationDays,
      done,
      needed,
      amount,
      fullAmount,
      state: reward ? "rewarded" : c.missedCount > 0 ? "missed" : done >= needed ? "completed" : "on_track",
      reward: reward ? { status: reward.status, amount: reward.amount } : null,
    });
  }
  return out.sort(byCloseness);
}

export type GoalInput = {
  commitmentId: string;
  title: string;
  totalPeriods: number;
  periodSeconds: number;
  /** Periods already resolved (on-chain currentPeriodIndex). */
  periodsResolved: number;
  /** This goal's daily-rewarded proofs so far. */
  rewardedProofs: number;
};

/**
 * Completion progress for Forfeit goals in an earning slot. `amount` is what
 * finishing pays if every remaining period earns its daily reward — the
 * best case, and exactly what the engine would pay then; days the goal
 * spent outside a slot already reduced it.
 */
export function computeGoalProgress(params: {
  goals: GoalInput[];
  completionRewards: HistoryItem[];
  config: RewardsConfig;
}): CompletionProgress[] {
  const { config } = params;
  const rewardByGoal = new Map(params.completionRewards.map((r) => [r.goalRef, r]));
  const out: CompletionProgress[] = [];
  for (const g of params.goals) {
    if (g.totalPeriods <= 0) continue;
    const reward = rewardByGoal.get(g.commitmentId) ?? null;
    const durationDays = Math.round((g.totalPeriods * g.periodSeconds) / 86_400);
    const fullAmount = completionAmountFor(durationDays, config.goalCompletion.tiers);
    if (!reward && fullAmount <= 0) continue;
    const remaining = Math.max(0, g.totalPeriods - g.periodsResolved);
    const bestShare = Math.min(1, (g.rewardedProofs + remaining) / g.totalPeriods);
    const amount = reward?.amount ?? proratedCompletionAmount(fullAmount, bestShare, config.goalCompletion.shareExponent);
    if (!reward && amount <= 0) continue;
    out.push({
      kind: "forfeit",
      unit: g.periodSeconds === 86_400 ? "days" : g.periodSeconds === 7 * 86_400 ? "weeks" : progressUnit(durationDays, g.totalPeriods),
      ref: g.commitmentId,
      title: g.title,
      durationDays,
      done: Math.min(g.rewardedProofs, g.totalPeriods),
      needed: g.totalPeriods,
      amount,
      fullAmount,
      state: reward ? "rewarded" : "on_track",
      reward: reward ? { status: reward.status, amount: reward.amount } : null,
    });
  }
  return out.sort(byCloseness);
}
