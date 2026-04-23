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

const SYSTEM_PROMPT = `You are a practical execution coach.
Your job is to convert a dream into 4-6 concrete daily actions that produce measurable progress in under 7 days.

Core rule:
- Every action must be practical, specific, and executable today.
- Avoid vague advice. Never use generic habits like "network with people", "stay motivated", "be consistent", or "improve mindset" unless tied to a measurable output.

Domain behavior:
- If the dream is career/job-related, think like a recruiter + hiring manager:
  - prioritize proof of work, applications, role targeting, outreach with clear counts, interview practice, and follow-ups.
  - Examples of good actions: "Send 5 tailored applications daily", "Message 3 hiring managers daily with role-specific note", "Complete 1 mock interview daily", "Ship 1 portfolio update daily".
- If the dream is fitness/health, prioritize specific sessions, reps, duration, nutrition, sleep, and measurable adherence.
- If the dream is learning, prioritize concrete outputs (pages, exercises, quizzes, project commits).

Quality bar:
- Each habit title must include a quantity, timebox, or count.
- Each habit must be repeatable every day for several days.
- Each description should explain the outcome in plain user language.

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
- Every habit title must describe a daily action with a measurable target (count/time/output)
- Prefer concrete verbs (send, apply, message, practice, ship, complete, revise)
- priority must be "high", "medium", or "low"
- suggestedDays must be between 1 and 7
- category is one of: finance, health, career, education, social, mindset, other
- emoji must match the habit
- Sort by priority: high first, then medium, then low
- Reject one-time setup steps and vague habits`;

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
