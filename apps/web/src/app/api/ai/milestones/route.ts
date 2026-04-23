import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AiMilestone {
  title: string;
  days: number;
}

const SYSTEM_PROMPT = `You are a practical milestone planner.
Given a dream and a duration (1-7 days), generate concrete checkpoint milestones that a real person can verify.

Rules:
- Return practical checkpoints, not motivational phrases.
- Each milestone title should describe observable progress/output (max 10 words).
- Milestone days must be whole numbers within the duration and strictly increasing.
- Final milestone must always be on the final day of the duration.

Important behavior:
- If the dream is repetitive/habit-based (gym, workout, running, reading, studying, practice, meditation, posting content, etc), create a streak-style timeline that spans the full duration.
  - For repetitive goals, prefer one checkpoint per day (up to duration), each representing streak progress.
- If the dream is project/outcome-based, create fewer but meaningful checkpoints (usually 3-5) distributed across the duration.

For job/career dreams, think like a recruiter/hiring manager:
- checkpoints should reflect real hiring progress (tailored applications sent, outreach sent, interviews practiced, portfolio/resume improvements, follow-ups).

Return ONLY valid JSON, no markdown.`;

const USER_PROMPT = (goal: string, durationDays: number) =>
  `My dream: "${goal}" (${durationDays} day${durationDays !== 1 ? "s" : ""} total)

Generate practical milestone checkpoints for this duration.
No milestone day can exceed ${durationDays}. The final milestone must be on day ${durationDays}.

Return this exact JSON:
{
  "milestones": [
    { "title": "Checkpoint title", "days": 1 },
    { "title": "Checkpoint title", "days": ${durationDays} }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, durationDays } = body;
    const duration = Math.max(1, Math.min(7, Number(durationDays) || 7));

    if (!goal || typeof goal !== "string" || goal.trim().length < 3) {
      return errorResponse("A valid goal is required", 400);
    }

    if (!process.env.OPENAI_API_KEY) {
      return errorResponse("AI service not configured", 503);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT(goal.trim(), duration) },
      ],
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as { milestones: AiMilestone[] };
    if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
      return errorResponse("Invalid AI response", 502);
    }

    const isLikelyRepetitiveGoal = /gym|workout|run|running|lift|exercise|read|study|practice|meditat|journal|post|content|daily|habit/i.test(
      goal
    );

    const desiredCount = isLikelyRepetitiveGoal
      ? Math.max(3, duration)
      : duration <= 3
      ? 3
      : duration <= 5
      ? 4
      : 5;

    const cleaned = parsed.milestones
      .slice(0, 10)
      .map((m) => ({
        title: String(m.title || "").slice(0, 80).trim(),
        days: Math.max(1, Math.min(duration, Math.round(Number(m.days) || 1))),
      }))
      .filter((m) => m.title.length > 0);

    const uniqueByDay = new Map<number, AiMilestone>();
    for (const m of cleaned) {
      if (!uniqueByDay.has(m.days)) uniqueByDay.set(m.days, m);
    }

    const milestones: AiMilestone[] = [];
    if (isLikelyRepetitiveGoal) {
      for (let day = 1; day <= duration; day++) {
        const existing = uniqueByDay.get(day);
        milestones.push(
          existing ?? {
            title: day === duration ? `Complete day ${day} streak` : `Finish day ${day} streak`,
            days: day,
          }
        );
      }
    } else {
      const fallbackDays = Array.from(new Set([
        1,
        Math.max(1, Math.ceil(duration * 0.4)),
        Math.max(1, Math.ceil(duration * 0.7)),
        duration,
      ])).sort((a, b) => a - b);

      const source = Array.from(uniqueByDay.values()).sort((a, b) => a.days - b.days);
      for (const m of source) {
        if (milestones.length >= desiredCount) break;
        milestones.push(m);
      }
      for (const day of fallbackDays) {
        if (milestones.length >= desiredCount) break;
        if (!milestones.some((m) => m.days === day)) {
          milestones.push({
            title: day === duration ? "Final checkpoint complete" : `Checkpoint complete by day ${day}`,
            days: day,
          });
        }
      }
      milestones.sort((a, b) => a.days - b.days);
    }

    if (!milestones.some((m) => m.days === duration)) {
      milestones.push({
        title: `Finish full ${duration}-day commitment`,
        days: duration,
      });
    }

    milestones.sort((a, b) => a.days - b.days);

    return jsonResponse({ milestones });
  } catch (err: any) {
    console.error("[/api/ai/milestones]", err);
    return errorResponse(err?.message || "Failed to generate milestones", 500);
  }
}
