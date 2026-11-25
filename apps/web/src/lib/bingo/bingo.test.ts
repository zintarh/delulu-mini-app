import { test } from "node:test";
import assert from "node:assert/strict";
import { cyclePhase, daySlot, lagosMidnight, nextLagosMidnight, versionSchemaFor, DAY_MS } from "@/lib/bingo/types";
import { buildSquares } from "@/lib/bingo/view";
import { fmtRange } from "@/lib/bingo/format";

const starts = lagosMidnight("2026-11-18").toISOString(); // 2026-11-17T23:00Z
const ends = new Date(Date.parse(starts) + 7 * DAY_MS).toISOString();

test("cycle days run Lagos midnight to midnight", () => {
  assert.equal(starts, "2026-11-17T23:00:00.000Z");
  assert.equal(daySlot(starts, ends, Date.parse("2026-11-17T22:59:59Z")), null);
  assert.equal(daySlot(starts, ends, Date.parse("2026-11-17T23:00:00Z")), 0);
  assert.equal(daySlot(starts, ends, Date.parse("2026-11-18T22:59:59Z")), 0);
  assert.equal(daySlot(starts, ends, Date.parse("2026-11-18T23:00:00Z")), 1);
  assert.equal(daySlot(starts, ends, Date.parse("2026-11-24T22:59:59Z")), 6);
  assert.equal(daySlot(starts, ends, Date.parse(ends)), null);
});

test("cycle phase", () => {
  assert.equal(cyclePhase({ starts_at: starts, ends_at: ends }, Date.parse(starts) - 1), "upcoming");
  assert.equal(cyclePhase({ starts_at: starts, ends_at: ends }, Date.parse(starts)), "live");
  assert.equal(cyclePhase({ starts_at: starts, ends_at: ends }, Date.parse(ends)), "ended");
});

test("next Lagos midnight is strictly after now", () => {
  assert.equal(nextLagosMidnight(Date.parse("2026-11-17T12:00:00Z")).toISOString(), "2026-11-17T23:00:00.000Z");
  assert.equal(nextLagosMidnight(Date.parse("2026-11-17T23:00:00Z")).toISOString(), "2026-11-18T23:00:00.000Z");
  assert.equal(nextLagosMidnight(Date.parse("2026-11-17T23:30:00Z")).toISOString(), "2026-11-18T23:00:00.000Z");
});

test("display range uses the last day, not the exclusive end", () => {
  assert.equal(fmtRange(starts, ends), "18 – 24 Nov");
  const e2 = new Date(Date.parse(lagosMidnight("2026-11-25").toISOString()) + 7 * DAY_MS).toISOString();
  assert.equal(fmtRange(lagosMidnight("2026-11-25").toISOString(), e2), "25 Nov – 1 Dec");
});

test("version rules: 7-day needs exactly 7 required + ≤2 bonus; tiers unique", () => {
  const seven = Array.from({ length: 7 }, (_, i) => ({ title: `Mission ${i + 1}`, bonus: false }));
  const tiers = [{ key: "starter", label: "Starter", stake: 1000, forfeitPct: 10 as const }];
  assert.ok(versionSchemaFor(7).safeParse({ missions: [...seven, { title: "Bonus one", bonus: true }], tiers }).success);
  assert.ok(!versionSchemaFor(7).safeParse({ missions: seven.slice(0, 6), tiers }).success);
  assert.ok(!versionSchemaFor(7).safeParse({ missions: [...seven.slice(0, 6), { title: "Bonus", bonus: true }, { title: "Bonus 2", bonus: true }], tiers }).success);
  assert.ok(!versionSchemaFor(7).safeParse({ missions: seven, tiers: [...tiers, tiers[0]] }).success);
  assert.ok(!versionSchemaFor(7).safeParse({ missions: seven, tiers: [{ ...tiers[0], forfeitPct: 7 }] }).success);
});

test("squares: only filled counts; unfilled required squares are missed once the cycle is over", () => {
  const missions = [
    { title: "Sky", bonus: false },
    { title: "Food", bonus: false },
    { title: "Shoes", bonus: true },
  ];
  const rows = [
    { id: "1", attempt_id: "a", square_index: 0, mission_title: "Sky", bonus: false, slot_index: 0, proof_url: "u0", status: "filled" as const, filled_at: "t" },
    { id: "2", attempt_id: "a", square_index: 1, mission_title: "Food", bonus: false, slot_index: 1, proof_url: "u1", status: "confirming" as const, filled_at: null },
  ];
  const live = buildSquares(missions, rows, false);
  assert.deepEqual(live.map((s) => s.state), ["filled", "confirming", "empty"]);
  const over = buildSquares(missions, rows, true);
  // A proof that never reached the chain doesn't count; an empty bonus square isn't a miss.
  assert.deepEqual(over.map((s) => s.state), ["filled", "missed", "empty"]);
});

test("rolling card: each day needs its square or the card ends; personal clock from join", async () => {
  const { rollingMissedDay, rollingAttemptOver } = await import("@/lib/bingo/types");
  const started = "2026-11-17T15:30:00.000Z";
  const ends = new Date(Date.parse(started) + 3 * DAY_MS).toISOString();
  const at = (h: number) => Date.parse(started) + h * 3_600_000;
  const a0 = { started_at: started, ends_at: ends, required_filled: 0 };
  assert.equal(daySlot(started, ends, at(23)), 0);
  assert.equal(rollingMissedDay(a0, at(23)), false);
  // Day 1 closed with nothing filled → over.
  assert.equal(rollingMissedDay(a0, at(24)), true);
  assert.equal(rollingAttemptOver(a0, 3, at(24)), true);
  // Day 1 done, now on day 2 → still going until day 2 closes.
  const a1 = { ...a0, required_filled: 1 };
  assert.equal(daySlot(started, ends, at(30)), 1);
  assert.equal(rollingAttemptOver(a1, 3, at(30)), false);
  assert.equal(rollingAttemptOver(a1, 3, at(48)), true);
  // All three → complete.
  assert.equal(rollingAttemptOver({ ...a0, required_filled: 3 }, 3, at(50)), true);
});

test("next step: every state says what to do next", async () => {
  const { bingoNextStep, proofNextStep } = await import("@/lib/next-step");
  const missions = [
    { title: "Share a selfie", bonus: false },
    { title: "Something you love", bonus: false },
    { title: "Something that made you smile", bonus: false },
  ];
  const now = Date.now();
  // Cards run midnight to midnight (Lagos): this one started at the last Lagos midnight.
  const lagosNow = new Date(now + 3_600_000);
  const started = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate()) - 3_600_000).toISOString();
  const mk = (me: Record<string, unknown> | null, extra: Record<string, unknown> = {}) =>
    ({
      id: "first3", slug: "my-first-3", title: "My First 3", description: null, coverImageUrl: null,
      durationDays: 3, enrollment: "rolling", recurrence: "one_time", missions, cycle: null,
      tiers: [{ key: "entry", label: "Entry", stake: 100, forfeitPct: 0, campaignId: null, challengeId: null, ready: true }],
      joinable: !me, players: 4, photos: [], rewards: { perProof: 100, completion: 0 },
      me: me && {
        attemptId: "a", wallet: "0x1", username: null, avatarUrl: null, tierKey: "entry", tierLabel: "Entry", stake: 100,
        status: "active", squaresFilled: 0, requiredFilled: 0, lastFilledAt: null, startedAt: started,
        endsAt: new Date(Date.parse(started) + 3 * DAY_MS).toISOString(), squares: [], phase: "live", today: 0,
        todayUsed: false, nextSquareAt: null, dayOrdered: true, missedDay: false, ...me,
      },
      ...extra,
    }) as never;
  const weekly = { ...(mk(null) as object), id: "oyb", slug: "outside-your-bubble", title: "Outside Your Bubble", durationDays: 7, enrollment: "fixed", joinable: true } as never;

  assert.match(bingoNextStep(mk(null)).cta?.label ?? "", /Start/);
  const day1 = bingoNextStep(mk({}));
  assert.equal(day1.title, "Day 1: Share a selfie");
  assert.equal(day1.cta?.action, "today");
  const doneToday = bingoNextStep(mk({ requiredFilled: 1, squaresFilled: 1, todayUsed: true, nextSquareAt: new Date(now + 3_600_000).toISOString() }));
  assert.match(doneToday.body ?? "", /Come back tomorrow for day 2: “Something you love”/);
  assert.equal(doneToday.remind, true);
  const last = bingoNextStep(mk({ requiredFilled: 2, squaresFilled: 2, today: 2 }));
  assert.equal(last.title, "Last square today!");
  const finished = bingoNextStep(mk({ requiredFilled: 3, squaresFilled: 3, today: 2, todayUsed: true }), [weekly]);
  assert.match(finished.body ?? "", /7-day Bingo/);
  assert.equal(finished.cta?.href, "/bingo/outside-your-bubble");
  const missed = bingoNextStep(mk({ missedDay: true }), [weekly]);
  assert.equal(missed.tone, "warn");
  assert.equal(missed.cta?.href, "/bingo/outside-your-bubble");

  assert.equal(proofNextStep({ milestoneIndex: 0, milestoneCount: 7 }).title, "Come back tomorrow");
  assert.equal(proofNextStep({ milestoneIndex: 6, milestoneCount: 7, nextBingo: weekly }).cta?.href, "/bingo/outside-your-bubble");
});

test("announced Bingo that isn't joinable yet says when it starts", async () => {
  const { bingoNextStep } = await import("@/lib/next-step");
  const startsAt = new Date(Date.now() + 20 * 3_600_000).toISOString();
  const b = {
    id: "oyb", slug: "outside-your-bubble", title: "Outside Your Bubble Bingo", description: null, coverImageUrl: null,
    durationDays: 7, enrollment: "fixed", recurrence: "one_time", missions: [{ title: "Capture the sky", bonus: false }],
    cycle: { id: "c", number: 1, startsAt, endsAt: new Date(Date.parse(startsAt) + 7 * DAY_MS).toISOString(), phase: "upcoming", today: null, joinable: false, joinClosesAt: startsAt },
    tiers: [{ key: "starter", label: "Starter", stake: 1000, forfeitPct: 10, campaignId: null, challengeId: null, ready: false }],
    joinable: false, players: 0, photos: [], rewards: { perProof: 100, completion: 500 }, me: null,
  } as never;
  const step = bingoNextStep(b);
  assert.match(step.title, /^Starts /);
  assert.equal(step.until, startsAt);
});

test("per-photo reward: a tier's own amount wins, else the global one", async () => {
  const { perSquareFor } = await import("@/lib/bingo/reward");
  const first3 = [{ key: "entry", rewardPerSquare: 50 }];
  assert.equal(perSquareFor(first3, "entry", 100), 50);
  assert.equal(perSquareFor(first3, null, 100), 50);
  const weekly = [{ key: "starter" }, { key: "pro" }, { key: "elite" }];
  assert.equal(perSquareFor(weekly, "pro", 100), 100);
  const mixed = [{ key: "starter", rewardPerSquare: 50 }, { key: "elite", rewardPerSquare: 200 }];
  assert.equal(perSquareFor(mixed, "elite", 100), 200);
  assert.equal(perSquareFor(mixed, null, 100), 50); // not playing: the smallest stake's amount
  assert.equal(perSquareFor([{ key: "a", rewardPerSquare: 10 }, { key: "b" }], null, 100), 100);
});

test("after a 7-day card: make it a personal habit", async () => {
  const { bingoNextStep, habitFor } = await import("@/lib/next-step");
  assert.equal(habitFor("Prayer Streak"), "Pray every day");
  assert.equal(habitFor("Outside Your Bubble Bingo"), "One good photo of my day");
  const missions = Array.from({ length: 7 }, (_, i) => ({ title: `M${i}`, bonus: false }));
  const step = bingoNextStep({
    id: "oyb", slug: "outside-your-bubble", title: "Outside Your Bubble Bingo", description: null, coverImageUrl: null,
    durationDays: 7, enrollment: "rolling", recurrence: "automatic", missions, cycle: null,
    tiers: [{ key: "pro", label: "Pro", stake: 2000, forfeitPct: 0, campaignId: null, challengeId: null, ready: true, completionReward: 1200 }],
    joinable: true, visible: true, players: 3, photos: [], rewards: { perProof: 100, completion: 500 },
    me: {
      attemptId: "a", wallet: "0x1", username: null, avatarUrl: null, tierKey: "pro", tierLabel: "Pro", stake: 2000, status: "active",
      squaresFilled: 7, requiredFilled: 7, lastFilledAt: null, startedAt: new Date().toISOString(), endsAt: new Date().toISOString(),
      squares: [], phase: "live", today: 6, todayUsed: true, nextSquareAt: null, dayOrdered: true, missedDay: false,
    },
  } as never);
  assert.equal(step.title, "You did 7 days! 🎉");
  assert.match(step.cta?.href ?? "", /^\/forfeit\?habit=/);
});

test("Home always has exactly one next step, in the right order", async () => {
  const { homeNextStep } = await import("@/lib/next-step");
  const mk = (slug: string, days: 3 | 7, recurrence: "one_time" | "automatic", me: Record<string, unknown> | null = null) =>
    ({
      id: slug, slug, title: slug, description: null, coverImageUrl: null, durationDays: days, enrollment: "rolling", recurrence,
      missions: Array.from({ length: days }, (_, i) => ({ title: `M${i}`, bonus: false })), cycle: null,
      tiers: [{ key: "t", label: "T", stake: 1000, forfeitPct: 0, campaignId: null, challengeId: null, ready: true }],
      joinable: !me, visible: true, players: 1, photos: [], rewards: { perProof: 100, completion: 500 },
      me: me && {
        attemptId: "a", wallet: "0x1", username: null, avatarUrl: null, tierKey: "t", tierLabel: "T", stake: 1000, status: "active",
        squaresFilled: 0, requiredFilled: 0, lastFilledAt: null, startedAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
        squares: [], phase: "live", today: 0, todayUsed: false, nextSquareAt: null, dayOrdered: true, missedDay: false, ...me,
      },
    }) as never;
  const debut = mk("delulu-debut", 3, "one_time");
  const weekly = mk("outside-your-bubble", 7, "automatic");
  const firstWeek = mk("first-week", 7, "one_time");

  // Not verified → verify first.
  assert.equal(homeNextStep({ bingos: [debut, weekly], verified: false }).step.cta?.action, "verify");
  // Verified newcomer → First Week, featured (so the list below skips it).
  const start = homeNextStep({ bingos: [debut, firstWeek, weekly], verified: true });
  assert.equal(start.featuredSlug, "first-week");
  assert.equal(start.step.kind, "first-week");
  assert.equal(start.step.cta?.href, "/play");
  // No First Week (not new) → a 7-day Bingo, never a 3-day one first.
  assert.equal(homeNextStep({ bingos: [debut, weekly], verified: true }).featuredSlug, "outside-your-bubble");
  // Playing → today's square beats everything (even unverified).
  const playing = homeNextStep({ bingos: [mk("delulu-debut", 3, "one_time", {}), weekly], verified: false });
  assert.equal(playing.step.cta?.action, "today");
  // Done today → "done for today", no button to chase.
  const done = homeNextStep({ bingos: [mk("delulu-debut", 3, "one_time", { todayUsed: true, requiredFilled: 1, nextSquareAt: new Date(Date.now() + 3600e3).toISOString() }), weekly], verified: true });
  assert.equal(done.step.title, "Done for today 🎉");
  // Finished Debut → level up to the 7-day.
  const finished = homeNextStep({ bingos: [mk("delulu-debut", 3, "one_time", { requiredFilled: 3, squaresFilled: 3, todayUsed: true, today: 2 }), weekly], verified: true });
  assert.equal(finished.step.cta?.href, "/bingo/outside-your-bubble");
});

test("rolling Bingo days follow the Lagos calendar: day 1 closes at midnight; late starts begin tomorrow", async () => {
  const { rollingFirstDeadline, rollingStartsTomorrow } = await import("@/lib/bingo/types");
  // 3:45pm Lagos (14:45Z) → day 1 ends tonight at Lagos midnight (23:00Z), not 3:45pm tomorrow.
  const afternoon = Date.parse("2026-11-18T14:45:00Z");
  assert.equal(new Date(rollingFirstDeadline(afternoon) * 1000).toISOString(), "2026-11-18T23:00:00.000Z");
  assert.equal(rollingStartsTomorrow(afternoon), false);
  // 9pm Lagos (20:00Z): only 3h left → the card starts tomorrow, day 1 ends tomorrow midnight.
  const late = Date.parse("2026-11-18T20:00:00Z");
  assert.equal(new Date(rollingFirstDeadline(late) * 1000).toISOString(), "2026-11-19T23:00:00.000Z");
  assert.equal(rollingStartsTomorrow(late), true);
});

test("old join-time cards say when their day resets; midnight cards don't", async () => {
  const { dayResetLabel } = await import("@/lib/next-step");
  assert.equal(dayResetLabel("2026-11-18T14:15:13+00:00"), "3:15pm"); // 3:15pm Lagos
  assert.equal(dayResetLabel("2026-11-19T23:00:00+00:00"), null); // Lagos midnight
});

test("an approved photo that never confirmed on-chain asks to finish, not 'add a photo'", async () => {
  const { bingoNextStep } = await import("@/lib/next-step");
  const missions = [{ title: "A", bonus: false }, { title: "B", bonus: false }, { title: "C", bonus: false }];
  const lagosNow = new Date(Date.now() + 3_600_000);
  const started = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), lagosNow.getUTCDate()) - 3_600_000 - 2 * DAY_MS).toISOString();
  const step = bingoNextStep({
    id: "d", slug: "delulu-debut", title: "Delulu Debut", description: null, coverImageUrl: null, durationDays: 3, enrollment: "rolling", recurrence: "one_time",
    missions, cycle: null, tiers: [], joinable: false, players: 1, photos: [], rewards: { perProof: 100, completion: 0 },
    me: {
      attemptId: "a", wallet: "0x1", username: null, avatarUrl: null, tierKey: "t", tierLabel: "T", stake: 1000, status: "active",
      squaresFilled: 2, requiredFilled: 2, lastFilledAt: null, startedAt: started, endsAt: new Date(Date.parse(started) + 3 * DAY_MS).toISOString(),
      squares: [
        { index: 0, title: "A", bonus: false, state: "filled", photoUrl: "x", filledAt: null },
        { index: 1, title: "B", bonus: false, state: "filled", photoUrl: "x", filledAt: null },
        { index: 2, title: "C", bonus: false, state: "confirming", photoUrl: "x", filledAt: null },
      ],
      phase: "live", today: 2, todayUsed: false, nextSquareAt: null, dayOrdered: true, missedDay: false,
    },
  } as never);
  assert.equal(step.title, "Almost done — confirm your last photo");
  assert.equal(step.cta?.label, "Finish");
});
