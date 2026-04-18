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

const SYSTEM_PROMPT = `You are a practical habit coach helping people build daily routines that move them toward their goals.
Your job is to break a goal into 4-6 DAILY REPEATABLE HABITS — things a person does every single day for a streak of days, not one-time setup tasks.

A valid habit looks like: "Read 20 minutes daily", "Drink 8 glasses of water", "Work out every morning".
An invalid habit looks like: "Choose a book", "Set up a schedule", "Join a group", "Create an environment" — these are one-time actions, NOT habits.

Every habit you return must pass this test: "Can someone do this action again tomorrow, and the day after, for 7 days in a row?" If no, do not include it.
Return ONLY valid JSON, no markdown, no explanation.`;

const USER_PROMPT = (goal: string) => `My goal is: "${goal}"

Give me 4-6 daily habits I need to practise every day for up to 7 days to make progress on this goal.
Each habit must be a repeatable daily action, not a one-time task.

Return this exact JSON structure:
{
  "habits": [
    {
      "id": "habit_1",
      "title": "Read 20 minutes daily",
      "description": "one sentence on why doing this every day moves you closer to the goal",
      "priority": "high",
      "suggestedDays": 7,
      "category": "mindset",
      "emoji": "📖"
    }
  ]
}

Rules:
- Every habit title must describe a daily action (include words like "daily", "every day", "each morning", or a daily quantity like "20 minutes", "8 glasses")
- priority must be "high", "medium", or "low"
- suggestedDays must be between 1 and 7
- category is one of: finance, health, career, education, social, mindset, other
- emoji must match the habit
- Sort by priority: high first, then medium, then low
- Reject any habit that is a one-time setup step`;

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
        suggestedDays: Math.max(1, Math.min(7, Number(h.suggestedDays) || 7)),
        category: (["finance","health","career","education","social","mindset","other"].includes(h.category) ? h.category : "other") as SideEffectHabit["category"],
        emoji: String(h.emoji || "🎯"),
      }));

    return jsonResponse({ habits });
  } catch (err: any) {
    console.error("[/api/ai/side-effects]", err);
    return errorResponse(err?.message || "Failed to generate side effects", 500);
  }
}
