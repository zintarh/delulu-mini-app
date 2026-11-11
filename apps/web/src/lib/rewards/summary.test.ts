import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REWARDS_CONFIG as config } from "./rules";
import {
  computeCampaignProgress,
  computeGoalProgress,
  computeTotals,
  computeWeeklyProgress,
  progressUnit,
  displayStatus,
  type HistoryItem,
} from "./summary";

function item(partial: Partial<HistoryItem>): HistoryItem {
  return {
    id: Math.random().toString(36),
    category: "daily_proof",
    amount: 100,
    status: "confirmed",
    txHash: null,
    goalKind: null,
    goalRef: null,
    goalTitle: null,
    periodKey: null,
    rewardDay: null,
    createdAt: "2026-11-11T10:00:00Z",
    confirmedAt: null,
    legacy: false,
    ...partial,
  };
}

test("status mapping: only confirmed / legacy sent count as paid", () => {
  assert.equal(displayStatus("confirmed", false), "confirmed");
  assert.equal(displayStatus("submitted", false), "pending");
  assert.equal(displayStatus("processing", false), "pending");
  assert.equal(displayStatus("pending", false), "pending");
  assert.equal(displayStatus("failed", false), "failed");
  assert.equal(displayStatus("sent", true), "confirmed");
  assert.equal(displayStatus("paying", true), "pending");
  assert.equal(displayStatus("capped", true), null);
  assert.equal(displayStatus("approved", true), null);
});

test("totals: failed and pending never count as earned", () => {
  const totals = computeTotals([
    item({ amount: 100 }),
    item({ amount: 10, legacy: true }),
    item({ category: "weekly_consistency", amount: 250 }),
    item({ category: "campaign_completion", amount: 500, status: "pending" }),
    item({ amount: 100, status: "failed" }),
  ]);
  assert.equal(totals.earned, 360);
  assert.deepEqual(totals.byCategory, { daily_proof: 110, weekly_consistency: 250, campaign_completion: 0, goal_completion: 0 });
  assert.equal(totals.pending, 500);
  assert.equal(totals.failed, 100);
});

test("weekly progress counts only this Mon–Sun week's daily rewards", () => {
  const p = computeWeeklyProgress({
    today: "2026-11-11", // Wed; week is Nov 9–15
    engineDailyDays: ["2026-11-08", "2026-11-09", "2026-11-09", "2026-11-11", "2026-11-16"],
    weeklyRewards: [],
    config,
  });
  assert.equal(p.proofs, 3);
  assert.equal(p.needed, 5);
  assert.equal(p.amount, 250);
  assert.equal(p.reward, null);
  assert.equal(p.weekStart, "2026-11-09");
});

test("weekly progress reports this week's bonus once granted", () => {
  const p = computeWeeklyProgress({
    today: "2026-11-11",
    engineDailyDays: [],
    weeklyRewards: [
      item({ category: "weekly_consistency", amount: 250, periodKey: "2026-W45" }),
      item({ category: "weekly_consistency", amount: 250, periodKey: "2026-W46", status: "pending" }),
    ],
    config,
  });
  assert.deepEqual(p.reward, { status: "pending", amount: 250 });
});

test("campaign progress: tiers, missed milestones, off-chain and short campaigns", () => {
  const base = { challengeId: 7, overdueCount: 0, missedCount: 0 };
  const rows = computeCampaignProgress({
    config,
    completionRewards: [item({ category: "campaign_completion", amount: 500, goalRef: "done" })],
    campaigns: [
      { ...base, campaignId: "a", title: "A", durationDays: 30, milestoneCount: 30, completedCount: 18 },
      { ...base, campaignId: "b", title: "B", durationDays: 90, milestoneCount: 90, completedCount: 40, overdueCount: 1, missedCount: 1 },
      { ...base, campaignId: "c", title: "C", durationDays: 5, milestoneCount: 5, completedCount: 1 },
      { ...base, campaignId: "d", title: "D", durationDays: 30, milestoneCount: 30, completedCount: 3, challengeId: 0 },
      { ...base, campaignId: "e", title: "E", durationDays: 7, milestoneCount: 7, completedCount: 7 },
      { ...base, campaignId: "done", title: "Done", durationDays: 7, milestoneCount: 7, completedCount: 7 },
    ],
  });
  const byId = Object.fromEntries(rows.map((r) => [r.ref, r]));
  assert.deepEqual(Object.keys(byId).sort(), ["a", "b", "done", "e"]);
  assert.equal(byId.a.state, "on_track");
  assert.equal(byId.a.amount, 1000);
  assert.equal(byId.a.done, 18);
  assert.equal(byId.a.needed, 30);
  assert.equal(byId.b.state, "missed");
  assert.equal(byId.b.amount, 5000);
  assert.equal(byId.e.state, "completed");
  assert.equal(byId.done.state, "rewarded");
  assert.equal(rows[rows.length - 1].ref, "b"); // missed sorts last
});

test("late joiner: owes only milestones open at join, bonus shrinks by share squared", () => {
  const [row] = computeCampaignProgress({
    config,
    completionRewards: [],
    // Joined after 15 of 30 daily milestones had closed; has done 5 since.
    campaigns: [
      { campaignId: "late", title: "L", durationDays: 30, challengeId: 7, milestoneCount: 30, completedCount: 5, overdueCount: 15, missedCount: 0 },
    ],
  });
  assert.equal(row.needed, 15);
  assert.equal(row.done, 5);
  assert.equal(row.fullAmount, 1000);
  assert.equal(row.amount, 250);
  assert.equal(row.state, "on_track");
});

test("goal progress: best case shrinks with days outside an earning slot", () => {
  const rows = computeGoalProgress({
    config,
    completionRewards: [],
    goals: [
      // 30-day daily goal, 10 days in, every day rewarded → still the full 1,000.
      { commitmentId: "full", title: "F", totalPeriods: 30, periodSeconds: 86_400, periodsResolved: 10, rewardedProofs: 10 },
      // Got a slot late: 15 of 30 days done, only 5 rewarded → best share 20/30.
      { commitmentId: "late", title: "L", totalPeriods: 30, periodSeconds: 86_400, periodsResolved: 15, rewardedProofs: 5 },
      // 3-day goal: no tier.
      { commitmentId: "short", title: "S", totalPeriods: 3, periodSeconds: 86_400, periodsResolved: 1, rewardedProofs: 1 },
    ],
  });
  const byId = Object.fromEntries(rows.map((r) => [r.ref, r]));
  assert.deepEqual(Object.keys(byId).sort(), ["full", "late"]);
  assert.equal(byId.full.amount, 1000);
  assert.equal(byId.late.amount, Math.floor(1000 * (20 / 30) ** 2));
  assert.equal(byId.late.done, 5);
  assert.equal(byId.late.needed, 30);
});

test("progress units follow milestone spacing", () => {
  assert.equal(progressUnit(30, 30), "days");
  assert.equal(progressUnit(28, 4), "weeks");
  assert.equal(progressUnit(30, 10), "steps");
  assert.equal(progressUnit(30, 0), "steps");
});
