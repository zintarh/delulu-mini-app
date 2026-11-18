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
  activeCard: null, recentMiss: null, referredBy: null, playedSlugs: [], finishedSlugs: [], ...over,
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
  assert.equal(pickNudge(base({ onboardedAt: null, giftSent: false, everStartedBingo: false, lastProofAt: null, createdAt: new Date(now - 1 * H).toISOString() }), now), null); // give them 2h first
  assert.equal(pickNudge(base({ giftSent: false, everStartedBingo: false, lastProofAt: null }), now)?.rule, "verify_for_gift");
  assert.equal(pickNudge(base({ everStartedBingo: false, lastProofAt: null }), now)?.rule, "gift_not_played");
  assert.equal(pickNudge(base({ pushOn: false }), now)?.rule, "install_app");
  // Not seen since tracking began → we don't know they haven't installed; don't nag.
  assert.notEqual(pickNudge(base({ pushOn: false, lastSeenAt: null }), now)?.rule, "install_app");
  // Installed and active, but nothing running → nudge into the 7-day Bingo (once a week).
  const idle = pickNudge(base({ pushOn: true }), now);
  assert.equal(idle?.rule, "seven_day_start");
  assert.equal(idle?.path, "/bingo/outside-your-bubble");
  // Mid-card and today's square isn't urgent → leave them be.
  const playing = { attemptId: "a2", slug: "x", title: "X", days: 7, startedAt: "", today: 2, todayFilled: true, todayMission: null, dayEndsAt: new Date(now + 12 * H).toISOString() };
  assert.equal(pickNudge(base({ pushOn: true, activeCard: playing }), now), null);
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
  assert.match(lvl!.emailBody, /Earn on Delulu every day/);
  assert.match(lvl!.emailBody, /^💸 Free money to claim every day$/m);
  assert.match(lvl!.emailBody, /5,000 G\$ for every friend/);
  // Active player during a round → referral nudge, once per round (after this week's 7-day nudge).
  const sevenDay = [{ rule: "seven_day_start", sentAt: new Date(live - 24 * H).toISOString(), acted: false }];
  assert.equal(pickNudge(p, live)?.rule, "seven_day_start");
  const ref = pickNudge(p, live, sevenDay);
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

test("someone in the app this week is never 'dormant'; long-time players get the 7-day nudge", () => {
  const live = Date.parse("2026-12-10T12:00:00Z");
  const seenToday = base({ createdAt: "2026-08-01T08:00:00Z", giftClaimedAt: "2026-08-02T08:00:00Z", dormant: true, lastSeenAt: new Date(live - 5 * H).toISOString(), lastProofAt: null, everStartedBingo: false, bestDays: 0, installedAt: "x" });
  assert.notEqual(pickNudge(seenToday, live)?.rule, "come_back");
  assert.equal(pickNudge(seenToday, live)?.rule, "seven_day_start");
  // Old account (no onboarding timestamp) still posting proofs, nothing running.
  const veteran = base({ onboardedAt: null, createdAt: "2026-08-01T08:00:00Z", installedAt: "x", lastProofAt: new Date(live - 20 * H).toISOString() });
  assert.equal(pickNudge(veteran, live)?.rule, "seven_day_start");
});

test("invited friends who go quiet get a nudge every 3 days naming their friend, rotating copy", () => {
  const live = Date.parse("2026-12-10T12:00:00Z");
  const friend = base({
    createdAt: "2026-09-20T08:00:00Z", giftClaimedAt: "2026-09-21T08:00:00Z", onboardedAt: null, installedAt: "x",
    lastSeenAt: null, lastProofAt: null, everStartedBingo: false, bestDays: 0, dormant: true,
    referredBy: { wallet: "0xref", username: "kaddy" },
  });
  const first = pickNudge(friend, live);
  assert.equal(first?.rule, "referred_back");
  assert.match(first!.title, /@kaddy/);
  const once = [{ rule: "referred_back", sentAt: new Date(live - 3 * 24 * H).toISOString(), acted: false }];
  assert.equal(pickNudge(friend, live, once)?.path, "/bingo/outside-your-bubble");
  // Active in the last 2 days → leave the referred track alone.
  assert.notEqual(pickNudge({ ...friend, lastSeenAt: new Date(live - 5 * H).toISOString(), dormant: false }, live)?.rule, "referred_back");
  // 5 ignored in a row → falls back to the normal come-back cadence.
  const five = [1, 2, 3, 4, 5].map((i) => ({ rule: "referred_back", sentAt: new Date(live - i * 3 * 24 * H).toISOString(), acted: false }));
  assert.notEqual(pickNudge(friend, live, five)?.rule, "referred_back");
});

test("new and invited players get the First Week offer ($ and ₦ from live config), once", () => {
  const live = Date.parse("2026-12-10T12:00:00Z");
  const money = (g: number) => ({ g, usd: g * 0.0001, ngn: g * 0.0001 * 1350 });
  const facts = {
    gdUsd: 0.0001, ngnPerUsd: 1350,
    sevenDay: { slug: "outside-your-bubble", title: "Outside Your Bubble Bingo", entry: money(1450), top: money(2950), perPhoto: 100 },
    firstWeek: { slug: "first-week", title: "Your First Week", entry: money(15000), top: money(15000), perPhoto: 1000 },
    topReferrers: [{ name: "metakay23", usd: 9.54, ngn: 12900 }],
    topCampaign: [{ name: "amakatdc", usd: 28.4, ngn: 38460 }],
  };
  const friend = base({
    createdAt: "2026-09-20T08:00:00Z", giftClaimedAt: "2026-09-21T08:00:00Z", onboardedAt: null, installedAt: "x",
    lastSeenAt: null, lastProofAt: null, everStartedBingo: false, bestDays: 0, dormant: true,
    referredBy: { wallet: "0xref", username: "kaddy" },
  });
  const n = pickNudge(friend, live, [], facts)!;
  assert.equal(n.rule, "referred_back");
  assert.equal(n.path, "/bingo/first-week");
  assert.match(n.title, /\$1\.50/);
  assert.match(n.emailBody, /₦2,030/);
  assert.match(n.emailBody, /monthly leaderboard/);
  assert.match(n.emailBody, /@metakay23 \$9\.54/);
  assert.match(n.emailBody, /@kaddy invited you/);
  // Missed a day on it (played, not finished) → still offered; finished → back to the regular copy.
  assert.equal(pickNudge({ ...friend, playedSlugs: ["first-week"] }, live, [], facts)!.path, "/bingo/first-week");
  assert.notEqual(pickNudge({ ...friend, playedSlugs: ["first-week"], finishedSlugs: ["first-week"] }, live, [], facts)!.path, "/bingo/first-week");
  // An old, uninvited regular never gets it.
  const regular = base({ createdAt: "2026-08-01T08:00:00Z", giftClaimedAt: "2026-08-02T08:00:00Z", installedAt: "x" });
  assert.notEqual(pickNudge(regular, live, [], facts)?.path, "/bingo/first-week");
  // No facts (price feed down / not live yet) → plain copy, no invented numbers.
  assert.doesNotMatch(pickNudge(friend, live, [], null)!.emailBody, /\$1\.50/);
});

test("a new player with the gift but no card, or who missed a First Week day, is pointed at First Week", () => {
  const live = Date.parse("2026-12-10T12:00:00Z");
  const money = (g: number) => ({ g, usd: g * 0.0001, ngn: g * 0.0001 * 1350 });
  const facts = { gdUsd: 0.0001, ngnPerUsd: 1350, sevenDay: null, firstWeek: { slug: "first-week", title: "Your First Week", entry: money(6750), top: money(6750), perPhoto: 500 }, topReferrers: [], topCampaign: [] };
  const fresh = base({ createdAt: new Date(live - 20 * H).toISOString(), onboardedAt: new Date(live - 19 * H).toISOString(), giftClaimedAt: new Date(live - 18 * H).toISOString(), everStartedBingo: false, lastProofAt: null, bestDays: 0 });
  const gift = pickNudge(fresh, live, [], facts)!;
  assert.equal(gift.rule, "gift_not_played");
  assert.equal(gift.path, "/bingo/first-week");
  const missed = pickNudge({ ...fresh, everStartedBingo: true, playedSlugs: ["first-week"], recentMiss: { attemptId: "fw1", slug: "first-week", title: "Your First Week", oneTime: true } }, live, [], facts)!;
  assert.equal(missed.rule, "missed_day");
  assert.equal(missed.path, "/bingo/first-week");
});
