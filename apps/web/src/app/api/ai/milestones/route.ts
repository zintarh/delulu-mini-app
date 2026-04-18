import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AiMilestone {
  title: string;
  days: number;
}

const SYSTEM_PROMPT = `You are a goal-tracking coach. Given a daily habit goal that lasts up to 7 days, you create exactly 3 milestone checkpoints that mark real progress.

Rules:
- Return exactly 3 milestones
- Each milestone title must be a short, specific, observable checkpoint (max 8 words) — something the user can tick off as done
- Days must be whole numbers between 1 and 7, distributed sensibly across the goal duration (e.g. day 2, day 5, day 7)
- No repeated days — each milestone must be on a different day
- Milestone 3 must be the final day of the goal (day 7 or the total duration)
- Return ONLY valid JSON, no markdown`;

const USER_PROMPT = (goal: string, durationDays: number) =>
  `My dream: "${goal}" (${durationDays} day${durationDays !== 1 ? "s" : ""} total)

Give me exactly 3 milestone checkpoints distributed across this dream's duration.
No milestone day can exceed ${durationDays}. The final milestone must be on day ${durationDays}.

Return this exact JSON:
{
  "milestones": [
    { "title": "Complete first ${Math.ceil(durationDays / 3)} days without stopping", "days": ${Math.ceil(durationDays / 3)} },
    { "title": "Hit the halfway mark", "days": ${Math.ceil(durationDays * 0.6)} },
    { "title": "Finish the full ${durationDays}-day commitment", "days": ${durationDays} }
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
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as { milestones: AiMilestone[] };
    if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
      return errorResponse("Invalid AI response", 502);
    }

    const milestones: AiMilestone[] = parsed.milestones.slice(0, 5).map((m) => ({
      title: String(m.title || "").slice(0, 80),
      days: Math.max(1, Math.min(duration, Math.round(Number(m.days) || 1))),
    }));

    return jsonResponse({ milestones });
  } catch (err: any) {
    console.error("[/api/ai/milestones]", err);
    return errorResponse(err?.message || "Failed to generate milestones", 500);
  }
}
