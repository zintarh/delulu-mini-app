import test from "node:test";
import assert from "node:assert/strict";
import { periodOpensAt } from "./period-window";

const DAY = 86_400;

test("first period is always open", () => {
  assert.equal(periodOpensAt({ currentPeriodIndex: 0, currentPeriodDeadline: 10 * DAY, periodSeconds: DAY }, 0), null);
});

test("next period is closed until its 24h window starts", () => {
  // Day 1 proved at 9:50 with a 10:00 deadline → day 2's deadline is 10:00 tomorrow.
  const tenAmTomorrow = 2 * DAY;
  const chain = { currentPeriodIndex: 1, currentPeriodDeadline: tenAmTomorrow, periodSeconds: DAY };
  assert.equal(periodOpensAt(chain, DAY - 600), DAY);
  assert.equal(periodOpensAt(chain, DAY), null);
  assert.equal(periodOpensAt(chain, DAY + 3600), null);
});

test("one-off goals and bad data never lock", () => {
  assert.equal(periodOpensAt({ currentPeriodIndex: 1, currentPeriodDeadline: DAY, periodSeconds: 0 }, 0), null);
  assert.equal(periodOpensAt({ currentPeriodIndex: 1, currentPeriodDeadline: "x", periodSeconds: DAY }, 0), null);
});
