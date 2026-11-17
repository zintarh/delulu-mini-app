import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuietHours, lagosHour, pickNudge } from "@/lib/nudges/rules";
import type { Person } from "@/lib/nudges/people";

const H = 3_600_000;
const now = Date.parse("2026-11-20T15:00:00Z"); // 4pm Lagos
const base = (over: Partial<Person> = {}): Person => ({
  wallet: "0xabc", username: "ada", email: "ada@example.com", createdAt: new Date(now - 30 * H).toISOString(),
  onboardedAt: new Date(now - 29 * H).toISOString(), giftSent: true, giftClaimedAt: new Date(now - 28 * H).toISOString(),
  installedAt: null, lastSeenAt: new Date(now - 2 * H).toISOString(), platform: "android", pushOn: true,
  everStartedBingo: true, bestDays: 1, completedBingo: false, lastProofAt: new Date(now - 20 * H).toISOString(),
  activeCard: null, recentMiss: null, ...over,
});

test("quiet hours are 10pm–8am Lagos", () => {
  assert.equal(lagosHour(Date.parse("2026-11-20T21:00:00Z")), 22);
  assert.equal(isQuietHours(Date.parse("2026-11-20T21:00:00Z")), true);
  assert.equal(isQuietHours(Date.parse("2026-11-20T07:00:00Z")), false); // 8am
  assert.equal(isQuietHours(now), false);
});

test("today's square closing within 8h beats everything else", () => {
  const card = { attemptId: "a1", slug: "delulu-debut", title: "Delulu Debut", days: 3, startedAt: "", today: 1, todayFilled: false, todayMission: "Something you love", dayEndsAt: new Date(now + 5 * H).toISOString() };
  const n = pickNudge(base({ activeCard: card, installedAt: null, pushOn: false }), now);
  assert.equal(n?.rule, "square_due");
  assert.equal(n?.dedupeKey, "a1:1");
  assert.match(n!.title, /Day 2 closes in 5h/);
  // More than 8h left, or already filled → no square nudge.
  assert.notEqual(pickNudge(base({ activeCard: { ...card, dayEndsAt: new Date(now + 12 * H).toISOString() } }), now)?.rule, "square_due");
  assert.notEqual(pickNudge(base({ activeCard: { ...card, todayFilled: true } }), now)?.rule, "square_due");
});

test("first-days journey: setup → verify → play → install", () => {
  assert.equal(pickNudge(base({ onboardedAt: null, giftSent: false, everStartedBingo: false, lastProofAt: null, createdAt: new Date(now - 3 * H).toISOString() }), now)?.rule, "setup_unfinished");
  assert.equal(pickNudge(base({ onboardedAt: null, createdAt: new Date(now - 1 * H).toISOString() }), now), null); // give them 2h first
  assert.equal(pickNudge(base({ giftSent: false, everStartedBingo: false, lastProofAt: null }), now)?.rule, "verify_for_gift");
  assert.equal(pickNudge(base({ everStartedBingo: false, lastProofAt: null }), now)?.rule, "gift_not_played");
  assert.equal(pickNudge(base({ pushOn: false }), now)?.rule, "install_app");
  assert.equal(pickNudge(base({ pushOn: true }), now), null); // installed-or-push and playing fine → leave them be
});

test("missed a one-time Debut → point at Prayer Streak; quiet 3+ days → come back weekly", () => {
  const miss = pickNudge(base({ recentMiss: { attemptId: "a9", slug: "delulu-debut", title: "Delulu Debut", oneTime: true } }), now);
  assert.equal(miss?.rule, "missed_day");
  assert.equal(miss?.path, "/bingo/prayer-streak");
  const quiet = pickNudge(base({ lastSeenAt: new Date(now - 4 * 24 * H).toISOString(), lastProofAt: new Date(now - 5 * 24 * H).toISOString(), installedAt: "x" }), now);
  assert.equal(quiet?.rule, "come_back");
});
