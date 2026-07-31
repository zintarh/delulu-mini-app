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
 * Period 0 ends one full period after creation (capped by the chosen final
 * deadline); last period ends on the selected day.
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

  // The first check-in is always a full period away from creation (e.g. a
  // full 24h for daily/weekday) — never "end of today", which could give a
  // creator as little as a few minutes if they set it up late in the day.
  // Still capped by the chosen final deadline, in case that's sooner.
  let firstDeadline = Math.min(nowSec + periodSeconds, endSec);
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

    // The live on-chain period's deadline can land on a different calendar day
    // than its "expected" one (e.g. the create-time schedule and the on-chain
    // deadline drift by a day) — when that happens, whichever day it actually
    // falls on is the one that should be actionable, not the day the naive
    // origin+i mapping would have picked.
    const liveDueToday =
      startOfDay(new Date(liveDeadlineSec * 1000)).getTime() === today.getTime();

    let periodIndex: number;
    let periodStatus: PeriodStatus;
    if (isToday && liveDueToday) {
      // The currently-open (or just-missed) period is genuinely due today —
      // show it here even if the calendar's own day-count says otherwise.
      periodIndex = currentIdx;
      periodStatus = liveOpen ? "current" : "past";
    } else if (dayDate.getTime() < today.getTime()) {
      // A calendar day that's already elapsed is always "past" — there's no
      // such thing as an "upcoming" yesterday, no matter how far behind
      // currentIdx is (e.g. a missed period a keeper hasn't finalized yet).
      periodIndex = i;
      periodStatus = "past";
    } else if (dayDate.getTime() > today.getTime()) {
      periodIndex = i;
      periodStatus = "upcoming";
    } else if (i < currentIdx) {
      periodIndex = i;
      periodStatus = "past";
    } else if (i === currentIdx) {
      periodIndex = i;
      periodStatus = liveOpen ? "current" : "past";
    } else {
      // i > currentIdx and the live period isn't due today: only genuinely
      // "upcoming" while that live period is still open — once its deadline
      // has passed with nothing resolved, the whole commitment is done
      // (missing a period forfeits it outright), so later days read as past
      // too instead of dangling as a false "up next".
      periodIndex = i;
      periodStatus = liveOpen ? "upcoming" : "past";
    }
    const periodDeadlineSec = isToday ? liveDeadlineSec : nativeDeadlineSec;

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

  // Each period *opens* on its own calendar slot (days[i]) but is a true 24h
  // (or full-period) window from there, so its actual on-chain deadline lands
  // one full period later — the following calendar day for daily/weekday.
  if (input.repeatEvery === "day" || input.repeatEvery === "weekday") {
    const origin = slots[0]!.dayDate;
    for (let i = 0; i < schedule.totalPeriods; i++) {
      const deadlineSec = schedule.firstDeadline + i * (schedule.periodSeconds ?? 86_400);
      const deadlineDay = dayKey(new Date(deadlineSec * 1000));
      const expectedDay = dayKey(addDays(origin, i + 1));
      if (deadlineDay !== expectedDay) {
        return {
          ok: false,
          error: `Period ${i} deadline day ${deadlineDay} ≠ expected ${expectedDay} (opens ${days[i]})`,
        };
      }
    }
  }

  return { ok: true, schedule, days };
}

export type PeriodOutcome = "pending" | "won" | "failed" | "overdue";

export type PeriodOutcomeInput = {
  periodIndex: number;
  currentPeriodIndex: number;
  periodStatus: PeriodStatus;
  /**
   * On-chain truth for the whole commitment (subgraph/RPC ForfeitCommitment.active).
   * Only ever flips to `false` via a genuine PeriodResolvedForfeited,
   * CommitmentCancelled, or final-period-success event — never from calendar
   * time alone. `undefined` means on-chain state hasn't loaded yet.
   */
  commitmentActiveOnChain: boolean | undefined;
  period: {
    proofUrl: string | null;
    verifierAction: string | null;
    resolvedAt: string | null;
  } | null;
};

/**
 * Whether a given period ultimately succeeded, failed, is still open, or has
 * simply missed its deadline without a confirmed on-chain resolution yet.
 * Trusts the on-chain currentPeriodIndex first: that counter only ever
 * advances via a successful resolve (a miss ends the whole commitment
 * instead, it never increments it), so any period behind the live index
 * necessarily succeeded — even if the off-chain proof/resolve record for it
 * is missing or incomplete (e.g. a resolve that landed on-chain but didn't
 * get logged off-chain). Falling back to the off-chain record only matters
 * for the live/current period, where the chain hasn't moved past it yet.
 *
 * "failed" is reserved for a *confirmed* on-chain forfeiture
 * (commitmentActiveOnChain === false) — a deadline merely having passed
 * (periodStatus === "past") only means "overdue": the keeper hasn't
 * permissionlessly resolved it yet, nothing has actually moved on-chain.
 * Calendar time alone must never claim a forfeiture that hasn't happened.
 */
export function resolvePeriodOutcome(input: PeriodOutcomeInput): PeriodOutcome {
  if (input.periodIndex < input.currentPeriodIndex) return "won";

  const action = input.period?.verifierAction ?? null;
  if (action === "rejected" || action === "timed_out") return "failed";
  if (action === "approved" && input.period?.resolvedAt) return "won";
  if (input.period?.resolvedAt && input.period.proofUrl) return "won";
  if (input.commitmentActiveOnChain === false) return "failed";
  if (input.periodStatus === "past") return "overdue";
  return "pending";
}
