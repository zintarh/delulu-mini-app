import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SideEffectHabit {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  suggestedDays: number;
  category: "finance" | "health" | "career" | "education" | "social" | "mindset" | "other";
  emoji: string;
}

const SYSTEM_PROMPT = `You are a practical life coach helping people in the Global South achieve their everyday goals.
When given a goal, break it down into 5-8 specific, actionable prerequisite habits or conditions the person needs to have in place.
Focus on realistic, concrete things — not generic advice.
Return ONLY valid JSON, no markdown, no explanation.`;

const USER_PROMPT = (goal: string) => `My immediate goal is: "${goal}"

List the 5-8 most important habits, conditions, or sub-goals I need to have in place to achieve this.
Think about what someone actually needs step-by-step.

Return this exact JSON structure:
{
  "habits": [
    {
      "id": "habit_1",
      "title": "short title (max 5 words)",
      "description": "one sentence explaining why this matters",
      "priority": "high",
      "suggestedDays": 90,
      "category": "finance",
      "emoji": "💰"
    }
  ]
}

Rules:
- priority must be "high", "medium", or "low"
- suggestedDays is realistic (7-365)
- category is one of: finance, health, career, education, social, mindset, other
- emoji must match the category/habit
- Sort by priority: high first, then medium, then low`;

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();

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
        { role: "user", content: USER_PROMPT(goal.trim()) },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as { habits: SideEffectHabit[] };

    if (!Array.isArray(parsed.habits) || parsed.habits.length === 0) {
      return errorResponse("Invalid AI response format", 502);
    }

    // Sanitise and enforce schema
    const habits: SideEffectHabit[] = parsed.habits
      .slice(0, 8)
      .map((h, i) => ({
        id: h.id || `habit_${i + 1}`,
        title: String(h.title || "").slice(0, 60),
        description: String(h.description || "").slice(0, 200),
        priority: (["high", "medium", "low"].includes(h.priority) ? h.priority : "medium") as SideEffectHabit["priority"],
        suggestedDays: Math.max(7, Math.min(365, Number(h.suggestedDays) || 60)),
        category: (["finance","health","career","education","social","mindset","other"].includes(h.category) ? h.category : "other") as SideEffectHabit["category"],
        emoji: String(h.emoji || "🎯"),
      }));

    return jsonResponse({ habits });
  } catch (err: any) {
    console.error("[/api/ai/side-effects]", err);
    return errorResponse(err?.message || "Failed to generate side effects", 500);
  }
}
