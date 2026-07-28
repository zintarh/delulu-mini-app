/**
 * Verifies forfeit create schedule ↔ calendar day-card stay aligned.
 * Run: npx tsx src/lib/forfeit/verify-forfeit-schedule.ts
 */
import {
  assertScheduleCalendarAligned,
  buildForfeitCalendarSlots,
  dayKey,
  deadlineFromPreset,
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

  void longDeadline;
  console.log("OK: forfeit schedule ↔ calendar days are consistent");
  console.log("  3 days →", three.days.join(" · "));
  console.log("  Overlap Sun–Tue: both; Wed+: long only");
}

main();
