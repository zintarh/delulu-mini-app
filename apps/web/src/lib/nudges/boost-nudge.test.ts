import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNudge } from "@/lib/nudges/rules";
import type { Person } from "@/lib/nudges/people";

const H = 3_600_000;
const now = Date.parse("2027-03-11T09:00:00Z"); // 10am Lagos
const person = (card: Partial<NonNullable<Person["activeCard"]>>): Person => ({
  wallet: "0xabc", username: "ada", email: "ada@example.com", createdAt: new Date(now - 30 * H).toISOString(),
  onboardedAt: new Date(now - 29 * H).toISOString(), giftSent: true, giftClaimedAt: null,
  installedAt: new Date(now - 20 * H).toISOString(), lastSeenAt: new Date(now - 2 * H).toISOString(), platform: "android", pushOn: true,
  everStartedBingo: true, bestDays: 1, completedBingo: false, completedDays: 0, lastCompletedAt: null,
  lastProofAt: new Date(now - 20 * H).toISOString(), dormant: false, recentMiss: null, referredBy: null, playedSlugs: [], finishedSlugs: [],
  activeCard: { attemptId: "a1", slug: "prayer-streak", title: "Prayer Streak", days: 3, stake: 2000, startedAt: "", today: 1, todayFilled: false, todayMission: null, dayEndsAt: new Date(now + 14 * H).toISOString(), ...card },
});

test("boost_ready: early in the day, today not boosted", () => {
  const n = pickNudge(person({ boostDue: true }), now);
  assert.equal(n?.rule, "boost_ready");
  assert.equal(n?.dedupeKey, "a1:1:boost");
});

test("no boost nudge once boosted, after the photo, or when the day is closing", () => {
  assert.notEqual(pickNudge(person({ boostDue: false }), now)?.rule, "boost_ready");
  assert.notEqual(pickNudge(person({ boostDue: true, todayFilled: true }), now)?.rule, "boost_ready");
  // Within 8h the square_due reminder (photo first) takes over.
  assert.equal(pickNudge(person({ boostDue: true, dayEndsAt: new Date(now + 5 * H).toISOString() }), now)?.rule, "square_due");
});
