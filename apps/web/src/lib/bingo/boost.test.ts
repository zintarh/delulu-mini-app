import { test } from "node:test";
import assert from "node:assert/strict";
import { BOOST, boostSummary } from "@/lib/bingo/boost";

test("no boosts: 10% of the stake", () => {
  const s = boostSummary({ startStake: 3000, boosts: [], keptSlots: [0, 1, 2], days: 3 });
  assert.equal(s.pct, BOOST.basePct);
  assert.equal(s.cashback, 300);
  assert.equal(s.pot, 3000);
});

test("+1% per boosted day that was kept, on the whole pot", () => {
  const s = boostSummary({ startStake: 3000, boosts: [{ slot: 0, amount: 1000 }, { slot: 1, amount: 1000 }], keptSlots: [0, 1, 2], days: 3 });
  assert.equal(s.boostedKeptDays, 2);
  assert.equal(s.pct, 12);
  assert.equal(s.pot, 5000);
  assert.equal(s.cashback, 600);
});

test("a boosted day that wasn't kept adds nothing to the %", () => {
  const s = boostSummary({ startStake: 3000, boosts: [{ slot: 2, amount: 1000 }], keptSlots: [0, 1], days: 3 });
  assert.equal(s.pct, 10);
});

test("the whole top-up earns cashback, at any stake", () => {
  const s = boostSummary({ startStake: 100, boosts: [{ slot: 0, amount: 5_000 }], keptSlots: [0], days: 7 });
  assert.equal(s.pot, 5_100);
  assert.equal(s.countedPot, 5_100);
  assert.equal(s.cashback, Math.floor((5_100 * 11) / 100));
});

test("every day boosted and kept: the 17% club on a 7-day card, capped at max", () => {
  const boosts = Array.from({ length: 7 }, (_, slot) => ({ slot, amount: 500 }));
  const s = boostSummary({ startStake: 7000, boosts, keptSlots: [0, 1, 2, 3, 4, 5, 6], days: 7 });
  assert.equal(s.pct, 17);
  assert.equal(s.perfect, true);
  // Two boosts the same day count as one boosted day.
  const twice = boostSummary({ startStake: 7000, boosts: [{ slot: 0, amount: 100 }, { slot: 0, amount: 100 }], keptSlots: [0], days: 7 });
  assert.equal(twice.boostedKeptDays, 1);
});
