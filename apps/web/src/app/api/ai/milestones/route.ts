import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";

export interface AiMilestone {
  title: string;
  days: number; // duration in days (how long this step takes), NOT a cumulative day number
}

const HABIT_KEYWORDS = /gym|workout|run|running|lift|exercise|read|study|practice|meditat|journal|post|content|daily|habit|language|learn|duolingo|streak|language|yoga|diet|sleep|walk|code|coding|write|writing/i;

function getSmartMilestoneCount(isHabit: boolean, duration: number): number {
  if (isHabit) return duration; // one milestone per day
  if (duration <= 3) return 3;
  if (duration <= 7) return Math.min(4, duration);
  if (duration <= 14) return 5;
  return 6;
}

// Splits `total` days into `count` roughly-equal integer chunks.
// E.g. splitEven(5, 14) → [3, 3, 3, 3, 2]
function splitEven(count: number, total: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Milestones only ever ask for proof of the day(s) they cover — the campaign's
// own title already says what the participant is doing, so the checkpoint title
// doesn't need to (and shouldn't try to) restate it.
function dayRangeTitle(startDay: number, days: number): string {
  if (days <= 1) return `Submit proof for Day ${startDay}`;
  return `Submit proof for Days ${startDay}–${startDay + days - 1}`;
}

function toMilestones(durations: number[]): AiMilestone[] {
  let cursor = 1;
  return durations.map((days) => {
    const milestone: AiMilestone = { title: dayRangeTitle(cursor, days), days };
    cursor += days;
    return milestone;
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, durationDays, intervalDays: rawInterval } = body;
    const duration = Math.max(1, Math.min(365, Number(durationDays) || 7));
    const intervalDays = rawInterval ? Math.max(1, Math.min(duration, Number(rawInterval))) : null;

    if (!goal || typeof goal !== "string" || goal.trim().length < 3) {
      return errorResponse("A valid goal is required", 400);
    }

    let milestones: AiMilestone[];

    if (intervalDays) {
      // Interval-controlled: fixed checkpoint spacing.
      const count = Math.max(2, Math.floor(duration / intervalDays));
      const lastDays = duration - (count - 1) * intervalDays;
      const durations = Array.from({ length: count }, (_, i) =>
        i === count - 1 ? Math.max(1, lastDays) : intervalDays
      );
      milestones = toMilestones(durations);
    } else {
      // Auto mode: habit-style goals get one checkpoint per day, longer/project
      // goals get fewer, evenly-sized checkpoints.
      const isHabit = HABIT_KEYWORDS.test(goal.trim());
      const count = getSmartMilestoneCount(isHabit, duration);
      const durations = splitEven(count, duration);
      milestones = toMilestones(durations);
    }

    return jsonResponse({ milestones });
  } catch (err: any) {
    console.error("[/api/ai/milestones]", err);
    return errorResponse(err?.message || "Failed to generate milestones", 500);
  }
}
