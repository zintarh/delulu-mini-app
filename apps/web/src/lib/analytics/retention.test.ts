import { test } from "node:test";
import assert from "node:assert/strict";
import { cohortRetention } from "@/lib/analytics/retention";

const DAY = 86_400_000;
test("week-1 retention counts a kept day 7–13 days after signing up; pending until measurable", () => {
  const t0 = Date.parse("2026-11-03T10:00:00Z"); // a Tuesday
  const signups = [
    { wallet: "a", createdMs: t0 },
    { wallet: "b", createdMs: t0 + DAY },
    { wallet: "c", createdMs: t0 + 2 * DAY },
  ];
  const activity = new Map([
    ["a", [t0 + DAY, t0 + 8 * DAY]], // kept in week 2 ✓
    ["b", [t0 + 2 * DAY]], // only week 1
  ]);
  const [c] = cohortRetention(signups, activity, t0 + 30 * DAY);
  assert.equal(c.week, "2026-11-02");
  assert.equal(c.signups, 3);
  assert.equal(c.started, 2);
  assert.equal(c.week1, 1);
  assert.equal(cohortRetention(signups, activity, t0 + 10 * DAY)[0].week1, null);
});
