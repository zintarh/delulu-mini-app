import { test } from "node:test";
import assert from "node:assert/strict";
import { hasConsecutiveDays } from "@/lib/referral/streak";
import { REFERRAL_ROUNDS, roundCapacity, roundFirstPayment, roundHasStreakBonus } from "@/lib/referral/campaign";

test("3 days in a row, by Lagos day", () => {
  assert.equal(hasConsecutiveDays(["2026-11-18T09:00:00Z", "2026-11-19T09:00:00Z", "2026-11-20T09:00:00Z"]), true);
  // Two photos the same day count once.
  assert.equal(hasConsecutiveDays(["2026-11-18T09:00:00Z", "2026-11-18T15:00:00Z", "2026-11-19T09:00:00Z"]), false);
  // A gap breaks the run.
  assert.equal(hasConsecutiveDays(["2026-11-18T09:00:00Z", "2026-11-19T09:00:00Z", "2026-11-21T09:00:00Z"]), false);
  // 23:30 UTC is already the next day in Lagos.
  assert.equal(hasConsecutiveDays(["2026-11-17T23:30:00Z", "2026-11-19T09:00:00Z", "2026-11-20T09:00:00Z"]), true);
  assert.equal(hasConsecutiveDays([]), false);
});

test("round 1 keeps 7,000 = 4,000 first + 3,000 bonus", () => {
  const r = REFERRAL_ROUNDS[0];
  assert.equal(r.reward, 7_000);
  assert.equal(roundFirstPayment(r), 4000);
  assert.equal(r.reward - roundFirstPayment(r), 3000);
  assert.equal(roundHasStreakBonus(r), true);
  assert.equal(roundCapacity(r), r.slots);
});

test("from round 2: 2,630 per friend, about $0.30, all at once, no streak bonus", () => {
  for (const r of REFERRAL_ROUNDS.slice(1)) {
    assert.equal(r.reward, 2_630);
    assert.equal(roundFirstPayment(r), 2_630);
    assert.equal(roundHasStreakBonus(r), false);
  }
});
