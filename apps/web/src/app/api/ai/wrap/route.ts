import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface WrapAnalysis {
  punchline: string;
  vibe: string;
  rating: string;
  insight: string;
  encouragement: string;
  tone: "roast" | "mixed" | "applaud";
}

const SYSTEM_PROMPT = `You are the hype writer (and occasional savage critic) for Delulu — a web3 app where people stake money on their dreams and prove them by completing milestones on-chain.

Your job: write a Spotify Wrapped-style recap. Be a real personality — not a corporate bot.

TONE RULES (follow them strictly):
- completionRate = 0 AND delulusCount = 0 → tone: "roast". They haven't even started. Be gently brutal.
- completionRate = 0 AND delulusCount > 0 → tone: "roast". Full savage. They created dreams and abandoned every single one.
- completionRate between 1-39% → tone: "roast". Don't sugarcoat it. Call out the gap.
- completionRate between 40-69% → tone: "mixed". Acknowledge effort, challenge them to do better.
- completionRate between 70-99% → tone: "applaud". Genuine hype. They showed up.
- completionRate = 100% AND milestonesAchieved >= 3 → tone: "applaud". GO OFF. This is rare. Celebrate hard.

FIELD RULES:
- punchline: ONE punchy sentence, max 15 words. This is the BIG moment shown huge. For roast: savage but not cruel. For applaud: genuinely celebratory. No filler words. Make it land.
- vibe: ONE word. The energy this period captured. Not generic — make it specific to their numbers.
- rating: 2-3 word dreamer archetype. Earned. Not random.
- insight: 2-3 sentences. For roast: honest diagnosis of what happened (or didn't). For applaud: analyze the pattern of success. Reference actual numbers. Never use the word "journey."
- encouragement: One direct sentence. For roast: a specific challenge. For applaud: raise the bar for next period.
- tone: "roast" | "mixed" | "applaud"

Return ONLY valid JSON. No markdown.`;

const buildPrompt = (
  delulusCount: number,
  resolvedCount: number,
  milestonesAchieved: number,
  totalMilestones: number,
  completionRate: number,
  deluluTitles: string[],
  totalPointsEarned: number,
  period: string
) =>
  `User's ${period} stats on Delulu:
- Delulus created: ${delulusCount}
- Fully resolved: ${resolvedCount}
- Milestones verified: ${milestonesAchieved} out of ${totalMilestones}
- Completion rate: ${completionRate}%
- Points earned: ${totalPointsEarned}
${deluluTitles.length > 0 ? `- Dreams they created: ${deluluTitles.slice(0, 3).join("; ")}` : "- Zero delulus created yet"}

Write their ${period} wrap. Return exactly:
{
  "punchline": "...",
  "vibe": "...",
  "rating": "...",
  "insight": "...",
  "encouragement": "...",
  "tone": "roast" | "mixed" | "applaud"
}`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return errorResponse("AI service not configured", 503);
    }

    const body = await req.json();
    const {
      delulusCount,
      resolvedCount,
      milestonesAchieved,
      totalMilestones,
      completionRate,
      deluluTitles,
      totalPointsEarned,
      period,
    } = body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildPrompt(
            Number(delulusCount) || 0,
            Number(resolvedCount) || 0,
            Number(milestonesAchieved) || 0,
            Number(totalMilestones) || 0,
            Number(completionRate) || 0,
            Array.isArray(deluluTitles) ? deluluTitles : [],
            Number(totalPointsEarned) || 0,
            String(period || "this period")
          ),
        },
      ],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as WrapAnalysis;
    return jsonResponse({ wrap: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate wrap";
    console.error("[/api/ai/wrap]", err);
    return errorResponse(message, 500);
  }
}
