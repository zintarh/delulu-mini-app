import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEndsAt,
  milestoneLabel,
  normalizePublicDescription,
  parseSupportAmount,
  reachedSupportMilestones,
  suggestCategory,
  supportEligibility,
  weiToWhole,
} from "./rules";

const E18 = 10n ** 18n;
const now = new Date("2026-11-12T12:00:00Z");
const live = { active: true, cancelled: false };
const base = {
  isPrivate: false,
  status: "active",
  onChain: live,
  endsAt: new Date("2026-11-20T00:00:00Z"),
  now,
  creatorWallet: "0xAAA",
  supporterWallet: "0xbbb",
};

test("eligibility: only public, active, live, unexpired, not own", () => {
  assert.deepEqual(supportEligibility(base), { ok: true });
  assert.deepEqual(supportEligibility({ ...base, isPrivate: true }), { ok: false, reason: "private" });
  // null/undefined visibility is treated as private (default-private)
  assert.deepEqual(supportEligibility({ ...base, isPrivate: null }), { ok: false, reason: "private" });
  assert.deepEqual(supportEligibility({ ...base, status: "completed" }), { ok: false, reason: "not_active" });
  assert.deepEqual(supportEligibility({ ...base, status: "cancelled" }), { ok: false, reason: "not_active" });
  assert.deepEqual(supportEligibility({ ...base, onChain: { active: false, cancelled: true } }), { ok: false, reason: "cancelled" });
  assert.deepEqual(supportEligibility({ ...base, onChain: { active: false, cancelled: false } }), { ok: false, reason: "not_active" });
  assert.deepEqual(supportEligibility({ ...base, onChain: null }), { ok: false, reason: "not_active" });
  assert.deepEqual(supportEligibility({ ...base, endsAt: new Date("2026-11-12T11:59:59Z") }), { ok: false, reason: "ended" });
  assert.deepEqual(supportEligibility({ ...base, supporterWallet: "0xaaa" }), { ok: false, reason: "own" });
});

test("amount parsing: bounds, decimals, separators", () => {
  assert.deepEqual(parseSupportAmount("5000"), { ok: true, wei: 5000n * E18, whole: 5000 });
  assert.deepEqual(parseSupportAmount("10,000"), { ok: true, wei: 10_000n * E18, whole: 10000 });
  const dec = parseSupportAmount("1000.5");
  assert.ok(dec.ok && dec.wei === 1000n * E18 + 5n * 10n ** 17n);
  assert.equal(parseSupportAmount("999").ok, false);
  assert.equal(parseSupportAmount("10000001").ok, false);
  assert.equal(parseSupportAmount("-5000").ok, false);
  assert.equal(parseSupportAmount("1e5").ok, false);
  assert.equal(parseSupportAmount("1000.123").ok, false);
  assert.equal(parseSupportAmount("").ok, false);
});

test("weiToWhole keeps precision for display", () => {
  assert.equal(weiToWhole((25_000n * E18).toString()), 25000);
  assert.equal(weiToWhole("1500000000000000000"), 1.5);
  assert.equal(weiToWhole(null), 0);
  assert.equal(weiToWhole("garbage"), 0);
});

test("endsAt: last period deadline from chain state", () => {
  const d = computeEndsAt({ currentPeriodDeadline: 1_000_000, currentPeriodIndex: 2, totalPeriods: 7, periodSeconds: 86_400 });
  assert.equal(d?.getTime(), (1_000_000 + 4 * 86_400) * 1000);
  const once = computeEndsAt({ currentPeriodDeadline: 500, currentPeriodIndex: 0, totalPeriods: 1, periodSeconds: 0 });
  assert.equal(once?.getTime(), 500_000);
  assert.equal(computeEndsAt({ currentPeriodDeadline: 0, currentPeriodIndex: 0, totalPeriods: 1, periodSeconds: 1 }), null);
});

test("milestones: totals and supporter counts, stable keys", () => {
  assert.deepEqual(reachedSupportMilestones(9_999n * E18, 4), []);
  assert.deepEqual(reachedSupportMilestones(60_000n * E18, 10), ["total_10000", "total_50000", "supporters_5", "supporters_10"]);
  assert.equal(milestoneLabel("total_50000"), "50,000 G$ in support");
  assert.equal(milestoneLabel("supporters_10"), "10 supporters");
});

test("category suggestion + public description normalisation", () => {
  assert.equal(suggestCategory("Go to the gym"), "fitness");
  assert.equal(suggestCategory("Read 10 pages"), "learning");
  assert.equal(suggestCategory("Save 2k daily"), "finance");
  assert.equal(suggestCategory("No sugar"), "lifestyle");
  assert.equal(suggestCategory("Meditate"), "personal_development");
  assert.equal(suggestCategory("zzz"), "personal_development");
  assert.equal(normalizePublicDescription("  hi   there  "), "hi there");
  assert.equal(normalizePublicDescription("   "), null);
  assert.equal(normalizePublicDescription(42), null);
  assert.equal(normalizePublicDescription("x".repeat(400))?.length, 280);
});
