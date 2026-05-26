import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AiMilestone {
  title: string;
  days: number; // duration in days (how long this step takes), NOT a cumulative day number
}

// For habits: ask only for titles — we assign durations ourselves.
const HABIT_SYSTEM_PROMPT = `You are a practical milestone planner for habit-based goals.
Given a habit/daily goal and how many checkpoints to create, generate concrete milestone titles that show clear streak/progress stages a real person can verify.

Rules:
- Return only titles — no day numbers needed.
- Titles must describe observable progress (max 10 words each). Examples: "3-day streak reached", "First full week complete", "Halfway through the challenge", "Final day done".
- Titles should reflect meaningful stages, not just "Day X done".
- Order titles from early to final stage.

Return ONLY valid JSON: { "titles": ["title1", "title2", ...] }`;

const HABIT_USER_PROMPT = (goal: string, count: number, duration: number) =>
  `Habit goal: "${goal}" (${duration} days total, one checkpoint per day = ${count} checkpoints)

Generate ${count} milestone titles — one for each day, in order.
Each title describes what the user should have done or achieved on that specific day.
Day 1 is the start, day ${duration} is the finish. Show natural progression (early days = beginning, middle = building momentum, final days = completion/mastery).
Return: { "titles": ["Day 1 title", "Day 2 title", ..., "Day ${count} title"] }`;

// For project goals: ask for titles + relative duration weights.
const PROJECT_SYSTEM_PROMPT = `You are a practical milestone planner for project/outcome goals.
Given a goal and duration, generate concrete checkpoints with a duration weight for each step.

Rules:
- Each milestone title describes observable output (max 10 words).
- "days" is the duration for that step (how many days it takes), NOT a cumulative number.
- All durations must be whole numbers ≥ 1. They will be normalized to match the total duration.
- Earlier steps can be shorter (setup/planning), later steps longer (execution/completion).

For job/career dreams: checkpoints reflect real hiring progress (applications sent, outreach, interviews practiced, portfolio work, follow-ups).
For project/build goals: planning → research → core work → polish → done.

Return ONLY valid JSON: { "milestones": [{ "title": "...", "days": N }, ...] }`;

const PROJECT_USER_PROMPT = (goal: string, count: number, duration: number) =>
  `Goal: "${goal}" (${duration} days total, ~${count} checkpoints)

Generate ${count} milestone checkpoints. Each "days" value is the duration for that step (not a cumulative day).
They will be auto-scaled to total exactly ${duration} days.

Return: { "milestones": [{ "title": "...", "days": N }, ...] }`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, durationDays } = body;
    const duration = Math.max(1, Math.min(365, Number(durationDays) || 7));

    if (!goal || typeof goal !== "string" || goal.trim().length < 3) {
      return errorResponse("A valid goal is required", 400);
    }
    if (!process.env.OPENAI_API_KEY) {
      return errorResponse("AI service not configured", 503);
    }

    const isHabit = HABIT_KEYWORDS.test(goal);
    const count = getSmartMilestoneCount(isHabit, duration);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: isHabit
        ? [
            { role: "system", content: HABIT_SYSTEM_PROMPT },
            { role: "user", content: HABIT_USER_PROMPT(goal.trim(), count, duration) },
          ]
        : [
            { role: "system", content: PROJECT_SYSTEM_PROMPT },
            { role: "user", content: PROJECT_USER_PROMPT(goal.trim(), count, duration) },
          ],
      temperature: 0.6,
      max_tokens: isHabit ? Math.max(500, count * 30) : 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as { titles?: string[]; milestones?: AiMilestone[] };

    let milestones: AiMilestone[];

    if (isHabit) {
      // Titles only — we assign perfectly even durations
      const titles: string[] = (parsed.titles ?? [])
        .map((t) => String(t || "").slice(0, 80).trim())
        .filter(Boolean)
        .slice(0, count);

      if (titles.length < 3) return errorResponse("Not enough titles from AI", 502);

      const durations = splitEven(titles.length, duration);
      milestones = titles.map((title, i) => ({ title, days: durations[i] }));
    } else {
      // Project goal — use AI durations but normalize to exact total
      const raw_milestones: AiMilestone[] = (parsed.milestones ?? [])
        .map((m) => ({
          title: String(m.title || "").slice(0, 80).trim(),
          days: Math.max(1, Math.round(Number(m.days) || 1)),
        }))
        .filter((m) => m.title.length > 0)
        .slice(0, count);

      if (raw_milestones.length < 3) return errorResponse("Not enough milestones from AI", 502);

      // Normalize durations to sum exactly to `duration`
      const totalRaw = raw_milestones.reduce((s, m) => s + m.days, 0);
      let normalized = raw_milestones.map((m) =>
        Math.max(1, Math.round((m.days / totalRaw) * duration))
      );
      // Fix rounding drift
      let diff = duration - normalized.reduce((s, v) => s + v, 0);
      for (let i = 0; diff !== 0; i = (i + 1) % normalized.length) {
        if (diff > 0) { normalized[i]++; diff--; }
        else if (diff < 0 && normalized[i] > 1) { normalized[i]--; diff++; }
      }
      milestones = raw_milestones.map((m, i) => ({ title: m.title, days: normalized[i] }));
    }

    return jsonResponse({ milestones });
  } catch (err: any) {
    console.error("[/api/ai/milestones]", err);
    return errorResponse(err?.message || "Failed to generate milestones", 500);
  }
}
