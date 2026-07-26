/**
 * Verifies forfeit create schedule ↔ calendar day-card stay aligned.
 * Run: npx tsx src/lib/forfeit/verify-forfeit-schedule.ts
 */
import {
  assertScheduleCalendarAligned,
  buildForfeitCalendarSlots,
  dayKey,
  deadlineFromPreset,
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

  // First period starts today (deadline calendar day = Sunday)
  if (dayKey(new Date(three.schedule.firstDeadline * 1000)) !== "2026-07-26") {
    fail(
      `firstDeadline day=${dayKey(new Date(three.schedule.firstDeadline * 1000))}, want Sunday`,
    );
  }

  void longDeadline;
  console.log("OK: forfeit schedule ↔ calendar days are consistent");
  console.log("  3 days →", three.days.join(" · "));
  console.log("  Overlap Sun–Tue: both; Wed+: long only");
}

main();
