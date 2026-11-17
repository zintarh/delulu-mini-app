import { test } from "node:test";
import assert from "node:assert/strict";
import { isQuietHours, lagosHour, pickNudge } from "@/lib/nudges/rules";
import type { Person } from "@/lib/nudges/people";

const H = 3_600_000;
const now = Date.parse("2026-12-10T15:00:00Z"); // 4pm Lagos, no referral round open
const base = (over: Partial<Person> = {}): Person => ({
  wallet: "0xabc", username: "ada", email: "ada@example.com", createdAt: new Date(now - 30 * H).toISOString(),
  onboardedAt: new Date(now - 29 * H).toISOString(), giftSent: true, giftClaimedAt: new Date(now - 28 * H).toISOString(),
  installedAt: null, lastSeenAt: new Date(now - 2 * H).toISOString(), platform: "android", pushOn: true,
  everStartedBingo: true, bestDays: 1, completedBingo: false, completedDays: 0, lastCompletedAt: null,
  lastProofAt: new Date(now - 20 * H).toISOString(), dormant: false,
  activeCard: null, recentMiss: null, ...over,
});

test("quiet hours are 10pm–8am Lagos", () => {
  assert.equal(lagosHour(Date.parse("2026-12-10T21:00:00Z")), 22);
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
  // Not seen since tracking began → we don't know they haven't installed; don't nag.
  assert.notEqual(pickNudge(base({ pushOn: false, lastSeenAt: null }), now)?.rule, "install_app");
  assert.equal(pickNudge(base({ pushOn: true }), now), null); // installed-or-push and playing fine → leave them be
});

test("missed a one-time Debut → point at Prayer Streak; quiet 3+ days → come back weekly", () => {
  const miss = pickNudge(base({ recentMiss: { attemptId: "a9", slug: "delulu-debut", title: "Delulu Debut", oneTime: true } }), now);
  assert.equal(miss?.rule, "missed_day");
  assert.equal(miss?.path, "/bingo/prayer-streak");
  const quiet = pickNudge(base({ lastSeenAt: new Date(now - 4 * 24 * H).toISOString(), lastProofAt: new Date(now - 5 * 24 * H).toISOString(), installedAt: "x" }), now);
  assert.equal(quiet?.rule, "come_back");
});

test("offers ride along in every email; new moments: level up, referral week, dormant cadence", async () => {
  const live = Date.parse("2026-11-19T12:00:00Z"); // referral round 1 is open
  const p = base({ pushOn: true, installedAt: "x", lastSeenAt: new Date(live - 2 * H).toISOString(), lastProofAt: new Date(live - 3 * H).toISOString() });
  // Finished a 3-day → level up to the 7-day.
  const lvl = pickNudge({ ...p, completedBingo: true, completedDays: 3, lastCompletedAt: new Date(live - 5 * H).toISOString() }, live);
  assert.equal(lvl?.rule, "level_up");
  assert.match(lvl!.emailBody, /What's waiting for you on Delulu/);
  assert.match(lvl!.emailBody, /5,000 G\$ for every friend/);
  // Active player during a round → referral nudge, once per round.
  const ref = pickNudge(p, live);
  assert.equal(ref?.rule, "referral_week");
  assert.equal(ref?.dedupeKey, "2026-11-18");
  // Dormant account → come back every 2 weeks, but stop after 3 ignored in a row.
  const dormant = { ...p, dormant: true, lastSeenAt: null, lastProofAt: null, everStartedBingo: false, bestDays: 0 };
  assert.equal(pickNudge(dormant, live)?.rule, "come_back");
  const ignored = [1, 2, 3].map((i) => ({ rule: "come_back", sentAt: new Date(live - i * 14 * 24 * H).toISOString(), acted: false }));
  assert.equal(pickNudge(dormant, live, ignored), null);
});

test("never promise the welcome gift to accounts that can't get it", async () => {
  const { pickNudge: pick } = await import("@/lib/nudges/rules");
  const live = Date.parse("2026-11-19T12:00:00Z");
  const old = base({ createdAt: "2026-08-01T08:00:00Z", giftSent: false, dormant: true, lastSeenAt: null, lastProofAt: null, everStartedBingo: false, bestDays: 0 });
  const n = pick(old, live);
  assert.equal(n?.rule, "come_back");
  assert.doesNotMatch(n!.emailBody, /1,000 G\$ free/);
  assert.doesNotMatch(n!.body, /1,000 G\$ free/);
  const fresh = base({ createdAt: "2026-11-18T08:00:00Z", giftSent: false, dormant: true, lastSeenAt: null, lastProofAt: null, everStartedBingo: false, bestDays: 0 });
  assert.match(pick(fresh, live)!.emailBody, /1,000 G\$ free/);
});
