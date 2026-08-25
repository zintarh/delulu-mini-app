/**
 * Verifies forfeit create schedule ↔ calendar day-card stay aligned.
 * Run: npx tsx src/lib/forfeit/verify-forfeit-schedule.ts
 */
import {
  assertScheduleCalendarAligned,
  buildForfeitCalendarSlots,
  dayKey,
  deadlineFromPreset,
  nextOccurrenceOfTimeOfDay,
  resolvePeriodOutcome,
  scheduleFromDeadline,
} from "./forfeit-schedule";

const CADENCE = { day: 1, weekday: 2, week: 3 } as const;

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

function main() {
  // Sunday July 26, 2026 15:00 local
  const sunday = new Date(2026, 6, 26, 15, 0, 0, 0);
  if (sunday.getDay() !== 0) fail("Fixture must be a Sunday");

  // --- Presets mean inclusive calendar length ---
  const in3 = deadlineFromPreset("3 days", sunday);
  if (dayKey(in3) !== "2026-07-28") {
    fail(`3 days should end Tue Jul 28, got ${dayKey(in3)}`);
  }
  const in7 = deadlineFromPreset("7 days", sunday);
  if (dayKey(in7) !== "2026-08-01") {
    fail(`7 days should end Sat Aug 1, got ${dayKey(in7)}`);
  }

  // --- 3-day daily forfeit ---
  const three = assertScheduleCalendarAligned({
    deadlineDate: in3,
    isRepeat: true,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
  });
  if (!three.ok) fail(three.error);
  if (three.schedule.totalPeriods !== 3) {
    fail(`3-day forfeit totalPeriods=${three.schedule.totalPeriods}, want 3`);
  }
  if (three.days.join(",") !== "2026-07-26,2026-07-27,2026-07-28") {
    fail(`3-day calendar days=${three.days.join(",")}`);
  }

  // --- 7-day daily ---
  const seven = assertScheduleCalendarAligned({
    deadlineDate: in7,
    isRepeat: true,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
  });
  if (!seven.ok) fail(seven.error);
  if (seven.schedule.totalPeriods !== 7) {
    fail(`7-day forfeit totalPeriods=${seven.schedule.totalPeriods}, want 7`);
  }

  // --- Two forfeits stack on overlapping days ---
  const longDeadline = deadlineFromPreset("7 days", sunday); // reuse as stand-in; use 365 via manual
  const longEnd = new Date(2026, 6, 26 + 364, 23, 59, 59, 999); // 365 inclusive days
  const longSchedule = scheduleFromDeadline({
    deadlineDate: longEnd,
    isRepeat: true,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
  });
  if (longSchedule.totalPeriods !== 365) {
    fail(`365-day totalPeriods=${longSchedule.totalPeriods}, want 365`);
  }

  const shortSlots = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: three.schedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: three.schedule.firstDeadline,
    periodSeconds: 86_400,
    isRepeating: true,
    now: sunday,
  });
  const longSlots = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: longSchedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: longSchedule.firstDeadline,
    periodSeconds: 86_400,
    isRepeating: true,
    now: sunday,
  });

  for (const day of ["2026-07-26", "2026-07-27", "2026-07-28"]) {
    const shortHas = shortSlots.some((s) => dayKey(s.dayDate) === day);
    const longHas = longSlots.some((s) => dayKey(s.dayDate) === day);
    if (!shortHas || !longHas) {
      fail(`Both forfeits must appear on ${day} (short=${shortHas}, long=${longHas})`);
    }
  }
  const wed = "2026-07-29";
  if (shortSlots.some((s) => dayKey(s.dayDate) === wed)) {
    fail("3-day forfeit must NOT appear on Wednesday Jul 29");
  }
  if (!longSlots.some((s) => dayKey(s.dayDate) === wed)) {
    fail("365-day forfeit must appear on Wednesday Jul 29");
  }

  // First period opens today (Sunday) but is a true 24h window, so its
  // deadline lands Monday — never "end of today," which could give a creator
  // as little as minutes if they set up late in the day.
  if (dayKey(new Date(three.schedule.firstDeadline * 1000)) !== "2026-07-27") {
    fail(
      `firstDeadline day=${dayKey(new Date(three.schedule.firstDeadline * 1000))}, want Monday`,
    );
  }

  // --- After period 0 proof + auto-resolve, today stays on period 0 (past) ---
  const afterResolve = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: three.schedule.totalPeriods,
    currentPeriodIndex: 1,
    currentPeriodDeadlineSec: three.schedule.firstDeadline + 86_400,
    periodSeconds: 86_400,
    isRepeating: true,
    now: sunday,
  });
  const todaySlot = afterResolve.find((s) => dayKey(s.dayDate) === "2026-07-26");
  if (!todaySlot) fail("Expected today slot after period-0 resolve");
  if (todaySlot.periodIndex !== 0) {
    fail(`After resolve, today periodIndex=${todaySlot.periodIndex}, want 0`);
  }
  if (todaySlot.periodStatus !== "past") {
    fail(`After resolve, today status=${todaySlot.periodStatus}, want past`);
  }

  // --- Sunday's period was missed (never resolved) — Monday must not read as
  // "upcoming"; the whole commitment is done, so both days show past. ---
  const monday = new Date(2026, 6, 27, 15, 0, 0, 0);
  const missedSunday = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: three.schedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: three.schedule.firstDeadline,
    periodSeconds: 86_400,
    isRepeating: true,
    now: monday,
  });
  const sundaySlot = missedSunday.find((s) => dayKey(s.dayDate) === "2026-07-26");
  const mondaySlot = missedSunday.find((s) => dayKey(s.dayDate) === "2026-07-27");
  if (!sundaySlot || !mondaySlot) fail("Expected both Sunday and Monday slots");
  if (sundaySlot.periodStatus !== "past") {
    fail(`Missed Sunday should read past, got ${sundaySlot.periodStatus}`);
  }
  if (mondaySlot.periodStatus !== "past") {
    fail(
      `Monday after a missed Sunday should read past (not upcoming), got ${mondaySlot.periodStatus}`,
    );
  }

  // --- Regression: a 4-day daily forfeit where periods 0-1 succeeded and
  // period 2 (Tuesday) was missed and confirmed forfeited on-chain
  // (currentPeriodIndex stays at 2, active: false — a forfeiture never
  // advances the index). Tuesday's on-chain deadline lands Wednesday, same as
  // any other daily period. Viewed the very next day (Wednesday, when the
  // deadline crossed over): must show exactly Sun/Mon/Tue, no duplicate
  // Wednesday card aliased to the same period 2. ---
  const wednesday = new Date(2026, 6, 29, 10, 0, 0, 0);
  const forfeitedTuesdayDeadlineSec = three.schedule.firstDeadline + 2 * 86_400;
  const forfeitedSameDay = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: 4,
    currentPeriodIndex: 2,
    currentPeriodDeadlineSec: forfeitedTuesdayDeadlineSec,
    periodSeconds: 86_400,
    isRepeating: true,
    now: wednesday,
    commitmentActiveOnChain: false,
  });
  const forfeitedSameDayKeys = forfeitedSameDay.map((s) => dayKey(s.dayDate));
  if (forfeitedSameDayKeys.join(",") !== "2026-07-26,2026-07-27,2026-07-28") {
    fail(
      `Forfeited-on-Tuesday (viewed Wednesday) days=${forfeitedSameDayKeys.join(",")}, want Sun/Mon/Tue only (no duplicate Wednesday)`,
    );
  }
  const forfeitedTuesdaySlot = forfeitedSameDay.find(
    (s) => dayKey(s.dayDate) === "2026-07-28",
  )!;
  const forfeitedTuesdayOutcome = resolvePeriodOutcome({
    periodIndex: forfeitedTuesdaySlot.periodIndex,
    currentPeriodIndex: 2,
    periodStatus: forfeitedTuesdaySlot.periodStatus,
    commitmentActiveOnChain: false,
    period: null,
  });
  if (forfeitedTuesdayOutcome !== "failed") {
    fail(`Forfeited Tuesday should resolve failed, got ${forfeitedTuesdayOutcome}`);
  }

  // --- Same forfeited commitment, but viewed a month later. Must still show
  // only Sun/Mon/Tue — no phantom "Forfeited" card for every day between the
  // miss and whenever the calendar happens to be reopened. ---
  const muchLater = new Date(2026, 7, 27, 10, 0, 0, 0);
  const forfeitedMuchLater = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: 4,
    currentPeriodIndex: 2,
    currentPeriodDeadlineSec: forfeitedTuesdayDeadlineSec,
    periodSeconds: 86_400,
    isRepeating: true,
    now: muchLater,
    commitmentActiveOnChain: false,
  });
  const forfeitedMuchLaterKeys = forfeitedMuchLater.map((s) => dayKey(s.dayDate));
  if (forfeitedMuchLaterKeys.join(",") !== "2026-07-26,2026-07-27,2026-07-28") {
    fail(
      `Forfeited-on-Tuesday viewed a month later days=${forfeitedMuchLaterKeys.join(",")}, want Sun/Mon/Tue only (no leaking phantom days)`,
    );
  }

  // --- Period 0's real on-chain deadline drifted a day past its normal
  // (24h-from-creation) window — created Sunday, normally due Monday 3pm, but
  // actually still open and due Tuesday 3pm. Tuesday must show period 0 as
  // submittable ("current"), not as a mismatched "upcoming" period 2. ---
  const tuesdayMorning = new Date(2026, 6, 28, 10, 0, 0, 0);
  const driftedDeadline = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: three.schedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: three.schedule.firstDeadline + 86_400,
    periodSeconds: 86_400,
    isRepeating: true,
    now: tuesdayMorning,
  });
  const driftedTuesdaySlot = driftedDeadline.find(
    (s) => dayKey(s.dayDate) === "2026-07-28",
  );
  if (!driftedTuesdaySlot) fail("Expected a Tuesday slot for the drifted-deadline case");
  if (driftedTuesdaySlot.periodStatus !== "current") {
    fail(
      `Drifted period 0 due today should read current, got ${driftedTuesdaySlot.periodStatus}`,
    );
  }
  if (driftedTuesdaySlot.periodIndex !== 0) {
    fail(`Drifted period 0 due today should keep periodIndex 0, got ${driftedTuesdaySlot.periodIndex}`);
  }

  // --- Regression: a period resolved on-chain (currentPeriodIndex moved past
  // it) but whose off-chain proof row never got a resolvedAt/verifierAction
  // logged (the exact "Reading books" incident — period 0 submitted+resolved
  // on-chain, currentPeriodIndex reached 2, but period 0's DB row stayed
  // blank). Must read as "won", not fall through to "failed". ---
  const orphanedSuccess = resolvePeriodOutcome({
    periodIndex: 0,
    currentPeriodIndex: 2,
    periodStatus: "past",
    commitmentActiveOnChain: true,
    period: { proofUrl: "https://example.com/proof.jpg", verifierAction: null, resolvedAt: null },
  });
  if (orphanedSuccess !== "won") {
    fail(`Period behind currentPeriodIndex with no off-chain record should read won, got ${orphanedSuccess}`);
  }
  // A period genuinely never reached by the chain (currentPeriodIndex still
  // at/behind it), nothing on record, a past deadline, AND a confirmed
  // on-chain forfeiture (active: false) is a real, confirmed miss.
  const genuineMiss = resolvePeriodOutcome({
    periodIndex: 1,
    currentPeriodIndex: 0,
    periodStatus: "past",
    commitmentActiveOnChain: false,
    period: null,
  });
  if (genuineMiss !== "failed") {
    fail(`Period at/ahead of currentPeriodIndex, confirmed forfeited on-chain, should read failed, got ${genuineMiss}`);
  }

  // --- Regression: the exact mainnet incident. Deadline passed, nothing on
  // record, but the commitment is STILL active on-chain (no keeper has
  // resolved it yet — no PeriodResolvedForfeited event fired). Must read as
  // "overdue", never "failed" — calendar time alone can't claim a forfeiture
  // that hasn't actually happened. ---
  const overdueNotYetResolved = resolvePeriodOutcome({
    periodIndex: 1,
    currentPeriodIndex: 0,
    periodStatus: "past",
    commitmentActiveOnChain: true,
    period: null,
  });
  if (overdueNotYetResolved !== "overdue") {
    fail(
      `Period past deadline but still active on-chain should read overdue, got ${overdueNotYetResolved}`,
    );
  }

  // Same shape, but on-chain state hasn't loaded yet (undefined) — must still
  // fail safe to "overdue", never assume forfeiture without a confirmed `false`.
  const overdueUnknownOnChainState = resolvePeriodOutcome({
    periodIndex: 1,
    currentPeriodIndex: 0,
    periodStatus: "past",
    commitmentActiveOnChain: undefined,
    period: null,
  });
  if (overdueUnknownOnChainState !== "overdue") {
    fail(
      `Period past deadline with unknown on-chain state should read overdue, got ${overdueUnknownOnChainState}`,
    );
  }

  // --- Weekly cadence: calendar slots must step 7 days at a time and stay
  // on the same weekday as creation, not silently fall back to daily steps. ---
  const weeklyDeadline = new Date(2026, 6, 26 + 28, 23, 59, 59, 999); // 4 weeks out
  const weeklySchedule = scheduleFromDeadline({
    deadlineDate: weeklyDeadline,
    isRepeat: true,
    repeatEvery: "week",
    now: sunday,
    cadenceByRepeat: CADENCE,
  });
  if (weeklySchedule.totalPeriods !== 4) {
    fail(`Weekly 4-week span totalPeriods=${weeklySchedule.totalPeriods}, want 4`);
  }
  const weeklySlots = buildForfeitCalendarSlots({
    createdAt: sunday,
    totalPeriods: weeklySchedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: weeklySchedule.firstDeadline,
    periodSeconds: 604_800,
    isRepeating: true,
    now: sunday,
  });
  const weeklyDays = weeklySlots.map((s) => dayKey(s.dayDate));
  const expectedWeeklyDays = ["2026-07-26", "2026-08-02", "2026-08-09", "2026-08-16"];
  if (weeklyDays.join(",") !== expectedWeeklyDays.join(",")) {
    fail(`Weekly slots=${weeklyDays.join(",")}, want ${expectedWeeklyDays.join(",")}`);
  }
  for (const d of weeklySlots.map((s) => s.dayDate)) {
    if (d.getDay() !== 0) fail(`Weekly slot ${dayKey(d)} should stay on Sunday`);
  }

  // --- Year boundary: a daily forfeit created Dec 28 must roll Dec 31 → Jan 1
  // cleanly (no duplicate/skipped calendar day, no year-math error). ---
  const dec28 = new Date(2026, 11, 28, 12, 0, 0, 0);
  const yearEndDeadline = deadlineFromPreset("7 days", dec28);
  if (dayKey(yearEndDeadline) !== "2027-01-03") {
    fail(`7 days from Dec 28 should end Jan 3, got ${dayKey(yearEndDeadline)}`);
  }
  const yearEndSchedule = scheduleFromDeadline({
    deadlineDate: yearEndDeadline,
    isRepeat: true,
    repeatEvery: "day",
    now: dec28,
    cadenceByRepeat: CADENCE,
  });
  const yearEndSlots = buildForfeitCalendarSlots({
    createdAt: dec28,
    totalPeriods: yearEndSchedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: yearEndSchedule.firstDeadline,
    periodSeconds: 86_400,
    isRepeating: true,
    now: dec28,
  });
  const yearEndDays = yearEndSlots.map((s) => dayKey(s.dayDate));
  const expectedYearEndDays = [
    "2026-12-28",
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
  ];
  if (yearEndDays.join(",") !== expectedYearEndDays.join(",")) {
    fail(`Year-boundary slots=${yearEndDays.join(",")}, want ${expectedYearEndDays.join(",")}`);
  }

  // --- nextOccurrenceOfTimeOfDay: later today stays today ---
  const laterToday = nextOccurrenceOfTimeOfDay(18, 0, sunday);
  if (dayKey(laterToday) !== "2026-07-26" || laterToday.getHours() !== 18) {
    fail(`6pm from 3pm same day should stay today at 18:00, got ${laterToday.toISOString()}`);
  }

  // --- nextOccurrenceOfTimeOfDay: already passed today bumps to tomorrow ---
  const alreadyPassed = nextOccurrenceOfTimeOfDay(10, 0, sunday);
  if (dayKey(alreadyPassed) !== "2026-07-27" || alreadyPassed.getHours() !== 10) {
    fail(`10am from 3pm same day should bump to tomorrow 10:00, got ${alreadyPassed.toISOString()}`);
  }

  // --- nextOccurrenceOfTimeOfDay: within the minimum lead window bumps too,
  // even though it's technically still later today ---
  const tooSoon = nextOccurrenceOfTimeOfDay(15, 2, sunday); // 2 min out, default lead is 5 min
  if (dayKey(tooSoon) !== "2026-07-27") {
    fail(`Cutoff 2 min out (under the 5 min lead) should bump to tomorrow, got ${tooSoon.toISOString()}`);
  }

  // --- shortDurationSeconds: deadline is simply now + duration, one-off ---
  const shortSchedule = scheduleFromDeadline({
    deadlineDate: sunday, // ignored when shortDurationSeconds is set
    isRepeat: false,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
    shortDurationSeconds: 30 * 60,
  });
  const sundaySec = Math.floor(sunday.getTime() / 1000);
  if (shortSchedule.firstDeadline !== sundaySec + 30 * 60) {
    fail(`30-min short duration firstDeadline=${shortSchedule.firstDeadline}, want ${sundaySec + 30 * 60}`);
  }
  if (shortSchedule.cadence !== 0 || shortSchedule.totalPeriods !== 1 || shortSchedule.periodSeconds !== undefined) {
    fail(`30-min short duration schedule shape wrong: ${JSON.stringify(shortSchedule)}`);
  }

  // --- cutoffTime, repeating daily: firstDeadline pins to the chosen clock
  // time (later today, since 6pm is still ahead of the 3pm fixture) instead
  // of the rolling now+24h window. totalPeriods stays calendar-day-based. ---
  const cutoffDaily = scheduleFromDeadline({
    deadlineDate: in7,
    isRepeat: true,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
    cutoffTime: { hours: 18, minutes: 0 },
  });
  const cutoffDailyDeadline = new Date(cutoffDaily.firstDeadline * 1000);
  if (dayKey(cutoffDailyDeadline) !== "2026-07-26" || cutoffDailyDeadline.getHours() !== 18) {
    fail(`Daily cutoff 6pm should land today at 18:00, got ${cutoffDailyDeadline.toISOString()}`);
  }
  if (cutoffDaily.totalPeriods !== 7) {
    fail(`Daily cutoff totalPeriods=${cutoffDaily.totalPeriods}, want 7 (unaffected by cutoffTime)`);
  }

  // --- cutoffTime, non-repeating: deadline lands on the selected end day at
  // the chosen time, not end-of-day. ---
  const cutoffOnce = scheduleFromDeadline({
    deadlineDate: in3,
    isRepeat: false,
    repeatEvery: "day",
    now: sunday,
    cadenceByRepeat: CADENCE,
    cutoffTime: { hours: 9, minutes: 30 },
  });
  const cutoffOnceDeadline = new Date(cutoffOnce.firstDeadline * 1000);
  if (dayKey(cutoffOnceDeadline) !== dayKey(in3) || cutoffOnceDeadline.getHours() !== 9 || cutoffOnceDeadline.getMinutes() !== 30) {
    fail(`Once cutoff 9:30am should land on ${dayKey(in3)} at 09:30, got ${cutoffOnceDeadline.toISOString()}`);
  }

  void longDeadline;
  console.log("OK: forfeit schedule ↔ calendar days are consistent");
  console.log("  3 days →", three.days.join(" · "));
  console.log("  Overlap Sun–Tue: both; Wed+: long only");
}

main();
