/**
 * Single source of truth for forfeit calendar + on-chain schedule.
 * Create UI, day card, and optimistic feed must all derive dates from here.
 */

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dayKey(date: Date): string {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000,
  );
}

/** Inclusive calendar days from today through the deadline day (local). */
export function inclusiveCalendarDays(from: Date, through: Date): number {
  return Math.max(1, daysBetween(from, through) + 1);
}

export const FORFEIT_DEADLINE_PRESETS = [
  "Tomorrow",
  "3 days",
  "7 days",
] as const;

export type ForfeitDeadlinePreset = (typeof FORFEIT_DEADLINE_PRESETS)[number];

/**
 * Preset end dates mean "last calendar day of the forfeit", inclusive of today.
 * "3 days" → today, tomorrow, day-after (3 days), NOT a 4th day.
 */
export function deadlineFromPreset(
  preset: ForfeitDeadlinePreset,
  now: Date = new Date(),
): Date {
  switch (preset) {
    case "Tomorrow":
      return endOfDay(addDays(now, 1));
    case "3 days":
      return endOfDay(addDays(now, 2));
    case "7 days":
      return endOfDay(addDays(now, 6));
    default:
      return endOfDay(addDays(now, 6));
  }
}

export type ForfeitRepeatEvery = "day" | "weekday" | "week";

export const PERIOD_SECONDS_BY_CADENCE: Record<ForfeitRepeatEvery, number> = {
  day: 86_400,
  weekday: 86_400,
  week: 604_800,
};

/** Matches on-chain ForfeitCadence enum values used by the create hook. */
export const CADENCE_BY_REPEAT: Record<ForfeitRepeatEvery, number> = {
  day: 1, // ForfeitCadence.Daily — keep in sync with hook
  weekday: 2,
  week: 3,
};

export type ForfeitSchedule = {
  firstDeadline: number;
  totalPeriods: number;
  periodSeconds: number | undefined;
  cadence: number;
};

/**
 * On-chain schedule from the duration ("ends on") date.
 * Period 0 always ends today (local EOD); last period ends on the selected day.
 * totalPeriods === number of calendar days the day-card will show (daily cadence).
 */
export function scheduleFromDeadline(input: {
  deadlineDate: Date;
  isRepeat: boolean;
  repeatEvery: ForfeitRepeatEvery;
  now?: Date;
  /** Injected cadence map so UI can pass real ForfeitCadence enums. */
  cadenceByRepeat?: Record<ForfeitRepeatEvery, number>;
}): ForfeitSchedule {
  const now = input.now ?? new Date();
  const endSec = Math.floor(input.deadlineDate.getTime() / 1000);
  const nowSec = Math.floor(now.getTime() / 1000);
  const cadenceMap = input.cadenceByRepeat ?? CADENCE_BY_REPEAT;

  if (!input.isRepeat) {
    return {
      cadence: 0, // Once
      firstDeadline: Math.max(endSec, nowSec + 60),
      totalPeriods: 1,
      periodSeconds: undefined,
    };
  }

  const cadence = cadenceMap[input.repeatEvery];
  const periodSeconds = PERIOD_SECONDS_BY_CADENCE[input.repeatEvery];

  const todayEndSec = Math.floor(endOfDay(now).getTime() / 1000);
  let firstDeadline = Math.min(todayEndSec, endSec);
  if (firstDeadline <= nowSec) {
    firstDeadline = Math.min(endSec, nowSec + Math.min(periodSeconds, 86_400));
  }
  if (firstDeadline <= nowSec) {
    firstDeadline = nowSec + 60;
  }

  // Prefer inclusive calendar-day count for daily/weekday so UI days match chain.
  if (input.repeatEvery === "day" || input.repeatEvery === "weekday") {
    const totalPeriods = inclusiveCalendarDays(now, input.deadlineDate);
    return { cadence, firstDeadline, totalPeriods, periodSeconds };
  }

  const totalPeriods = Math.max(
    1,
    Math.floor((endSec - firstDeadline) / periodSeconds) + 1,
  );
  return { cadence, firstDeadline, totalPeriods, periodSeconds };
}

export type PeriodStatus = "past" | "current" | "upcoming";

export type ForfeitCalendarSlot = {
  dayDate: Date;
  /** On-chain period index for proof submit. */
  periodIndex: number;
  /** Display index for "Day X of Y" (0-based). */
  calendarPeriodIndex: number;
  periodDeadlineSec: number;
  periodStatus: PeriodStatus;
};

function periodDeadlineSecAt(
  currentIdx: number,
  currentDeadlineSec: number,
  periodSeconds: number,
  periodIndex: number,
): number {
  if (!Number.isFinite(currentDeadlineSec) || currentDeadlineSec <= 0) {
    return Math.floor(Date.now() / 1000) + 86_400;
  }
  return currentDeadlineSec - (currentIdx - periodIndex) * periodSeconds;
}

/**
 * Calendar slots for the day card. Daily forfeits: one slot per period starting
 * on the create day — so two forfeits created Sunday both appear Sun/Mon/Tue…
 */
export function buildForfeitCalendarSlots(input: {
  createdAt: Date | string;
  totalPeriods: number;
  currentPeriodIndex: number;
  currentPeriodDeadlineSec: number;
  periodSeconds: number;
  isRepeating: boolean;
  now?: Date;
}): ForfeitCalendarSlot[] {
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const origin = startOfDay(new Date(input.createdAt));
  const total = Math.max(1, input.totalPeriods);
  const currentIdx = input.currentPeriodIndex;
  const periodSeconds = Math.max(1, input.periodSeconds || 86_400);
  const daysSinceOrigin = daysBetween(origin, today);

  if (!input.isRepeating) {
    const deadlineSec = periodDeadlineSecAt(
      currentIdx,
      input.currentPeriodDeadlineSec,
      periodSeconds,
      currentIdx,
    );
    let endDay = startOfDay(new Date(Math.max(0, deadlineSec * 1000 - 1)));
    if (endDay.getTime() < origin.getTime()) endDay = origin;
    if (deadlineSec * 1000 > now.getTime() && endDay.getTime() < today.getTime()) {
      endDay = today;
    }

    const slots: ForfeitCalendarSlot[] = [];
    for (let d = origin; d.getTime() <= endDay.getTime(); d = addDays(d, 1)) {
      let periodStatus: PeriodStatus;
      if (d.getTime() < today.getTime()) periodStatus = "past";
      else if (d.getTime() > today.getTime()) periodStatus = "upcoming";
      else periodStatus = deadlineSec * 1000 > now.getTime() ? "current" : "past";

      slots.push({
        dayDate: d,
        periodIndex: currentIdx,
        calendarPeriodIndex: 0,
        periodDeadlineSec: deadlineSec,
        periodStatus,
      });
      if (slots.length > 400) break;
    }
    return slots;
  }

  const dayStep =
    periodSeconds >= 2_000_000 ? 30 : periodSeconds >= 600_000 ? 7 : 1;

  const slots: ForfeitCalendarSlot[] = [];
  for (let i = 0; i < total; i++) {
    const dayDate = addDays(origin, i * dayStep);
    const nativeDeadlineSec = periodDeadlineSecAt(
      currentIdx,
      input.currentPeriodDeadlineSec,
      periodSeconds,
      i,
    );
    const isToday = dayDate.getTime() === today.getTime();
    const liveDeadlineSec = periodDeadlineSecAt(
      currentIdx,
      input.currentPeriodDeadlineSec,
      periodSeconds,
      currentIdx,
    );
    const liveOpen = liveDeadlineSec * 1000 > now.getTime();

    // Always map calendar day i → period i for labels. On today, submit the
    // live on-chain period (handles legacy schedules that started "tomorrow").
    const periodIndex = isToday ? currentIdx : i;
    const periodDeadlineSec = isToday ? liveDeadlineSec : nativeDeadlineSec;

    let periodStatus: PeriodStatus;
    if (dayDate.getTime() < today.getTime()) {
      periodStatus = i <= currentIdx ? "past" : "upcoming";
    } else if (dayDate.getTime() > today.getTime()) {
      periodStatus = "upcoming";
    } else if (liveOpen && (i === currentIdx || i === daysSinceOrigin)) {
      periodStatus = "current";
    } else {
      periodStatus = liveOpen ? "upcoming" : "past";
    }

    slots.push({
      dayDate,
      periodIndex,
      calendarPeriodIndex: i,
      periodDeadlineSec,
      periodStatus,
    });
  }

  const todayAlready = slots.some((s) => s.dayDate.getTime() === today.getTime());
  if (!todayAlready && currentIdx < total) {
    const deadlineSec = periodDeadlineSecAt(
      currentIdx,
      input.currentPeriodDeadlineSec,
      periodSeconds,
      currentIdx,
    );
    slots.push({
      dayDate: today,
      periodIndex: currentIdx,
      calendarPeriodIndex: Math.min(currentIdx, total - 1),
      periodDeadlineSec: deadlineSec,
      periodStatus: deadlineSec * 1000 > now.getTime() ? "current" : "past",
    });
  }

  return slots;
}

/** Invariant checks used by verification script / tests. */
export function assertScheduleCalendarAligned(input: {
  deadlineDate: Date;
  isRepeat: boolean;
  repeatEvery: ForfeitRepeatEvery;
  now: Date;
  cadenceByRepeat?: Record<ForfeitRepeatEvery, number>;
}): { ok: true; schedule: ForfeitSchedule; days: string[] } | { ok: false; error: string } {
  const schedule = scheduleFromDeadline(input);
  if (!input.isRepeat) {
    return { ok: true, schedule, days: [dayKey(input.now)] };
  }

  const slots = buildForfeitCalendarSlots({
    createdAt: input.now,
    totalPeriods: schedule.totalPeriods,
    currentPeriodIndex: 0,
    currentPeriodDeadlineSec: schedule.firstDeadline,
    periodSeconds: schedule.periodSeconds ?? 86_400,
    isRepeating: true,
    now: input.now,
  });

  const days = slots.map((s) => dayKey(s.dayDate));
  const expectedCount =
    input.repeatEvery === "week"
      ? schedule.totalPeriods
      : inclusiveCalendarDays(input.now, input.deadlineDate);

  if (input.repeatEvery !== "week" && days.length !== expectedCount) {
    return {
      ok: false,
      error: `Expected ${expectedCount} calendar days, got ${days.length}: ${days.join(", ")}`,
    };
  }

  if (dayKey(slots[0]!.dayDate) !== dayKey(input.now)) {
    return {
      ok: false,
      error: `First day must be today (${dayKey(input.now)}), got ${dayKey(slots[0]!.dayDate)}`,
    };
  }

  if (dayKey(slots[slots.length - 1]!.dayDate) !== dayKey(input.deadlineDate)) {
    return {
      ok: false,
      error: `Last day must be deadline (${dayKey(input.deadlineDate)}), got ${dayKey(slots[slots.length - 1]!.dayDate)}`,
    };
  }

  // On-chain period i deadline's local calendar day should match slot i for daily.
  if (input.repeatEvery === "day" || input.repeatEvery === "weekday") {
    for (let i = 0; i < schedule.totalPeriods; i++) {
      const deadlineSec = schedule.firstDeadline + i * (schedule.periodSeconds ?? 86_400);
      const deadlineDay = dayKey(new Date(deadlineSec * 1000));
      if (deadlineDay !== days[i]) {
        return {
          ok: false,
          error: `Period ${i} deadline day ${deadlineDay} ≠ calendar day ${days[i]}`,
        };
      }
    }
  }

  return { ok: true, schedule, days };
}
