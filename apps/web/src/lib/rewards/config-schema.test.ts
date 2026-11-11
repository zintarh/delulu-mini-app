import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REWARDS_CONFIG, isCategoryEnabled, resolveRewardsConfig, type RewardsConfig } from "./rules";
import { diffRewardsConfig, validateRewardsConfig } from "./config-schema";

const clone = (): RewardsConfig => JSON.parse(JSON.stringify(DEFAULT_REWARDS_CONFIG));

test("defaults pass strict validation", () => {
  const r = validateRewardsConfig(clone());
  assert.equal(r.ok, true);
});

test("rejects out-of-range, non-integer and unknown fields", () => {
  const c: any = clone();
  c.dailyProof.amount = -5;
  c.dailyProof.maxEligibleGoals = 2.5;
  c.weeklyConsistency.surprise = 1;
  const r = validateRewardsConfig(c);
  assert.equal(r.ok, false);
  if (!r.ok) {
    const paths = r.issues.map((i) => i.path);
    assert.ok(paths.includes("dailyProof.amount"));
    assert.ok(paths.includes("dailyProof.maxEligibleGoals"));
    assert.ok(paths.includes("weeklyConsistency"));
  }
});

test("weekly threshold must be reachable with the daily goal limit", () => {
  const c = clone();
  c.dailyProof.maxEligibleGoals = 1;
  c.weeklyConsistency.minProofs = 8;
  const r = validateRewardsConfig(c);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.issues[0].path, "weeklyConsistency.minProofs");
  c.weeklyConsistency.minProofs = 7;
  assert.equal(validateRewardsConfig(c).ok, true);
});

test("tiers: unique lengths, longer never pays less", () => {
  const c = clone();
  c.campaignCompletion.tiers = [
    { minDays: 7, amount: 500 },
    { minDays: 7, amount: 600 },
  ];
  assert.equal(validateRewardsConfig(c).ok, false);
  c.campaignCompletion.tiers = [
    { minDays: 7, amount: 500 },
    { minDays: 30, amount: 400 },
  ];
  assert.equal(validateRewardsConfig(c).ok, false);
  c.campaignCompletion.tiers = [
    { minDays: 30, amount: 1000 },
    { minDays: 7, amount: 500 },
  ];
  const r = validateRewardsConfig(c);
  assert.equal(r.ok, true);
});

test("daily budget can't be smaller than the largest single reward", () => {
  const c = clone();
  c.limits.dailyBudget = 1000; // a 5,000 G$ tier could never go out
  assert.equal(validateRewardsConfig(c).ok, false);
  c.limits.dailyBudget = 5000;
  assert.equal(validateRewardsConfig(c).ok, true);
  c.limits.dailyBudget = 0; // no limit
  assert.equal(validateRewardsConfig(c).ok, true);
});

test("diff lists only changed fields; tier order doesn't count as a change", () => {
  const before = clone();
  const after = clone();
  after.dailyProof.amount = 150;
  after.weeklyConsistency.enabled = false;
  after.campaignCompletion.tiers = [...after.campaignCompletion.tiers].reverse();
  const changes = diffRewardsConfig(before, after);
  assert.deepEqual(
    changes.map((c) => c.path).sort(),
    ["dailyProof.amount", "weeklyConsistency.enabled"],
  );
  assert.deepEqual(changes.find((c) => c.path === "dailyProof.amount"), {
    path: "dailyProof.amount",
    before: 100,
    after: 150,
  });
});

test("category switches: master switch overrides; stored partial rows keep categories on", () => {
  const c = resolveRewardsConfig({ weeklyConsistency: { enabled: false } });
  assert.equal(isCategoryEnabled(c, "daily_proof"), true);
  assert.equal(isCategoryEnabled(c, "weekly_consistency"), false);
  assert.equal(isCategoryEnabled({ ...c, enabled: false }, "daily_proof"), false);
  assert.equal(resolveRewardsConfig({}).limits.dailyBudget, 0);
});
