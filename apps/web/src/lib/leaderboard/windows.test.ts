import { test } from "node:test";
import assert from "node:assert/strict";
import { WEEKLY_ANCHOR_MS, fortnightWindow, monthWindow, weekWindow } from "@/lib/leaderboard/windows";

test("weekly board: week 1 from Fri 20 Nov 00:00 Lagos, a new week every Friday", () => {
  assert.equal(new Date(WEEKLY_ANCHOR_MS).toISOString(), "2026-11-19T23:00:00.000Z");
  const w1 = weekWindow(Date.parse("2026-11-20T15:00:00Z"));
  assert.equal(w1.index, 1);
  assert.equal(new Date(w1.endMs).toISOString(), "2026-11-26T23:00:00.000Z");
  assert.equal(weekWindow(Date.parse("2026-11-26T23:00:00Z")).index, 2);
  // Before it starts: still week 1.
  assert.equal(weekWindow(Date.parse("2026-11-19T12:00:00Z")).index, 1);
});

test("2-week prize board: Round 1 is Fri 20 Nov – Thu 3 Dec, then every 14 days", () => {
  const r1 = fortnightWindow(Date.parse("2026-11-25T12:00:00Z"));
  assert.equal(r1.index, 1);
  assert.equal(new Date(r1.endMs).toISOString(), "2026-12-03T23:00:00.000Z");
  assert.equal(fortnightWindow(Date.parse("2026-12-04T00:00:00Z")).index, 2);
});

test("monthly board: the Lagos calendar month", () => {
  const m = monthWindow(Date.parse("2026-11-30T23:30:00Z")); // already 1 Dec in Lagos
  assert.equal(new Date(m.startMs).toISOString(), "2026-11-30T23:00:00.000Z");
  const n = monthWindow(Date.parse("2026-11-20T12:00:00Z"));
  assert.equal(new Date(n.startMs).toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(new Date(n.endMs).toISOString(), "2026-11-30T23:00:00.000Z");
});
