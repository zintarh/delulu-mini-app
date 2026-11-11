import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REWARDS_CONFIG,
  addDays,
  completionAmountFor,
  dailyProofDedupeKey,
  decideSlotRelease,
  isoWeekKey,
  owedMilestoneIds,
  proratedCompletionAmount,
  resolveRewardsConfig,
  rewardDayFor,
  weekBounds,
} from "./rules";

const tiers = DEFAULT_REWARDS_CONFIG.campaignCompletion.tiers;

test("default amounts match the spec", () => {
  const c = DEFAULT_REWARDS_CONFIG;
  assert.equal(c.dailyProof.amount, 100);
  assert.equal(c.dailyProof.maxEligibleGoals, 2);
  assert.equal(c.weeklyConsistency.amount, 250);
  assert.equal(c.weeklyConsistency.minProofs, 5);
  assert.equal(completionAmountFor(7, tiers), 500);
  assert.equal(completionAmountFor(30, tiers), 1000);
  assert.equal(completionAmountFor(90, tiers), 5000);
});

test("completion tiers pick the highest tier the duration reaches", () => {
  assert.equal(completionAmountFor(6, tiers), 0);
  assert.equal(completionAmountFor(14, tiers), 500);
  assert.equal(completionAmountFor(60, tiers), 1000);
  assert.equal(completionAmountFor(365, tiers), 5000);
  assert.equal(completionAmountFor(0, tiers), 0);
  assert.equal(completionAmountFor(NaN, tiers), 0);
  // Order of the configured list doesn't matter.
  assert.equal(completionAmountFor(45, [...tiers].reverse()), 1000);
});

test("config overrides apply field by field; bad fields keep defaults", () => {
  const c = resolveRewardsConfig({
    dailyProof: { amount: 150, maxEligibleGoals: -1 },
    weeklyConsistency: { minProofs: "5" },
    timezone: "Not/AZone",
  });
  assert.equal(c.dailyProof.amount, 150);
  assert.equal(c.dailyProof.maxEligibleGoals, 2);
  assert.equal(c.weeklyConsistency.minProofs, 5);
  assert.equal(c.timezone, "Africa/Lagos");
  assert.deepEqual(resolveRewardsConfig(null), DEFAULT_REWARDS_CONFIG);
  assert.equal(resolveRewardsConfig({ enabled: false }).enabled, false);
});

test("completion tiers: empty list disables, all-malformed keeps defaults", () => {
  assert.deepEqual(resolveRewardsConfig({ campaignCompletion: { tiers: [] } }).campaignCompletion.tiers, []);
  assert.deepEqual(
    resolveRewardsConfig({ campaignCompletion: { tiers: [{ minDays: "x" }] } }).campaignCompletion.tiers,
    tiers,
  );
  const custom = resolveRewardsConfig({ campaignCompletion: { tiers: [{ minDays: 14, amount: 700 }] } });
  assert.equal(completionAmountFor(20, custom.campaignCompletion.tiers), 700);
});

test("reward day follows the configured timezone, not UTC", () => {
  // 23:30 UTC on Nov 10 is 00:30 on Nov 11 in Lagos (UTC+1).
  const late = new Date("2026-11-10T23:30:00Z");
  assert.equal(rewardDayFor(late, "Africa/Lagos"), "2026-11-11");
  assert.equal(rewardDayFor(late, "UTC"), "2026-11-10");
});

test("weeks run Monday to Sunday", () => {
  assert.deepEqual(weekBounds("2026-11-11"), { start: "2026-11-09", end: "2026-11-15" }); // Wed
  assert.deepEqual(weekBounds("2026-11-09"), { start: "2026-11-09", end: "2026-11-15" }); // Mon
  assert.deepEqual(weekBounds("2026-11-15"), { start: "2026-11-09", end: "2026-11-15" }); // Sun
  assert.equal(isoWeekKey("2026-11-09"), isoWeekKey("2026-11-15"));
  assert.notEqual(isoWeekKey("2026-11-15"), isoWeekKey("2026-11-16"));
});

test("ISO week keys handle year edges", () => {
  assert.equal(isoWeekKey("2026-11-11"), "2026-W46");
  assert.equal(isoWeekKey("2027-01-01"), "2026-W53"); // Fri, belongs to 2026's last week
  assert.equal(isoWeekKey("2024-12-30"), "2025-W01"); // Mon, belongs to 2025
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("dedupe keys are stable and wallet-case-insensitive", () => {
  assert.equal(
    dailyProofDedupeKey("0xABC", "forfeit", "g1", "2026-11-11"),
    dailyProofDedupeKey("0xabc", "forfeit", "g1", "2026-11-11"),
  );
  assert.notEqual(
    dailyProofDedupeKey("0xabc", "forfeit", "g1", "2026-11-11"),
    dailyProofDedupeKey("0xabc", "forfeit", "g1", "2026-11-12"),
  );
});

test("slot release: completion frees at once, abandonment and idling cool down", () => {
  const config = DEFAULT_REWARDS_CONFIG.dailyProof;
  const today = "2026-11-11";
  assert.deepEqual(decideSlotRelease({ state: "active", lastActiveDay: "2026-11-10", today, config }), {
    release: false,
  });
  assert.deepEqual(decideSlotRelease({ state: "completed", lastActiveDay: today, today, config }), {
    release: true,
    reason: "completed",
    cooldownUntilDay: null,
  });
  assert.deepEqual(decideSlotRelease({ state: "abandoned", lastActiveDay: today, today, config }), {
    release: true,
    reason: "abandoned",
    cooldownUntilDay: "2026-11-18",
  });
  assert.deepEqual(decideSlotRelease({ state: "unknown", lastActiveDay: "2026-10-28", today, config }), {
    release: true,
    reason: "idle",
    cooldownUntilDay: "2026-11-18",
  });
  assert.deepEqual(decideSlotRelease({ state: "unknown", lastActiveDay: "2026-10-29", today, config }), {
    release: false,
  });
});

test("late joiners and part-slotted goals earn a steeply reduced share", () => {
  assert.equal(proratedCompletionAmount(1000, 1, 2), 1000);
  assert.equal(proratedCompletionAmount(1000, 1.2, 2), 1000);
  assert.equal(proratedCompletionAmount(1000, 0.5, 2), 250);
  assert.equal(proratedCompletionAmount(1000, 0.5, 1), 500);
  assert.equal(proratedCompletionAmount(5000, 0.2, 2), 200);
  assert.equal(proratedCompletionAmount(500, 0, 2), 0);
  assert.equal(proratedCompletionAmount(0, 1, 2), 0);
});

test("goal completion tiers and exponents are configurable separately", () => {
  const c = resolveRewardsConfig({
    goalCompletion: { tiers: [], shareExponent: 1 },
    campaignCompletion: { lateJoinExponent: 0.5 },
  });
  assert.deepEqual(c.goalCompletion.tiers, []);
  assert.equal(c.goalCompletion.shareExponent, 1);
  assert.equal(c.campaignCompletion.lateJoinExponent, 2); // below 1 would reward late joining more
  assert.deepEqual(c.campaignCompletion.tiers, tiers);
});

test("owed milestones exclude ones that closed before joining", () => {
  const ms = [10, 20, 30, 40].map((d, i) => ({ id: i, deadlineSec: d }));
  assert.deepEqual(owedMilestoneIds(ms, null), [0, 1, 2, 3]);
  assert.deepEqual(owedMilestoneIds(ms, 0), [0, 1, 2, 3]);
  assert.deepEqual(owedMilestoneIds(ms, 25), [2, 3]);
  assert.deepEqual(owedMilestoneIds(ms, 20), [2, 3]); // deadline exactly at join: already closed
});
