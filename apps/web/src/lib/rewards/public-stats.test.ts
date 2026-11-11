import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregatePayouts, compactCount } from "./public-stats";

test("payout stats: totals by token, distinct people, biggest G$ payout", () => {
  const s = aggregatePayouts([
    { wallet: "0xA", amount: 85_000, token: "G$" },
    { wallet: "0xa", amount: 6_000, token: "G$" }, // same person, different case
    { wallet: "0xB", amount: 100, token: "G$" },
    { wallet: "0xC", amount: 20, token: "USDT" },
    { wallet: "0xD", amount: 0, token: "G$" }, // ignored
    { wallet: "", amount: 50, token: "G$" }, // ignored
  ]);
  assert.deepEqual(s, { totalG: 91_100, totalUsd: 20, people: 3, biggestG: 85_000 });
});

test("compact counts", () => {
  assert.equal(compactCount(2_000_344), "2M");
  assert.equal(compactCount(1_274_244), "1.3M");
  assert.equal(compactCount(85_000), "85K");
  assert.equal(compactCount(46), "46");
  assert.equal(compactCount(9_999), "9,999");
});
