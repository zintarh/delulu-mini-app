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

test("board score: consistency and stake both climb — 7 days at 5k beats one day at 50k", async () => {
  const { boardScore } = await import("@/lib/leaderboard/windows");
  const steady = boardScore(7 * 500, 7); // 5k stake, 7 days → 3,500 × 1.7
  const oneDay = boardScore(5_000, 1); // 50k stake, 1 day → 5,000 × 1.1
  assert.equal(steady, 5950);
  assert.equal(oneDay, 5500);
  assert.ok(steady > oneDay);
  // Same days: the bigger stake wins.
  assert.ok(boardScore(7 * 1000, 7) > boardScore(7 * 500, 7));
});
