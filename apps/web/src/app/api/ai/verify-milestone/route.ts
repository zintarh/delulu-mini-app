import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VerifyMilestoneResponse {
  verified: boolean;
  reason: string;
}

/** IPFS CIDv0/CIDv1 or raw hex hash — not human-readable, useless as context. */
function isIPFSHash(str: string): boolean {
  return (
    str.startsWith("Qm") ||
    str.startsWith("bafy") ||
    str.startsWith("ipfs://") ||
    (str.length > 40 && /^[a-f0-9]+$/i.test(str))
  );
}

const SYSTEM_PROMPT = `You are a very lenient proof reviewer for a personal goal-tracking app.

Your job is simple: does this image show ANY connection to the stated goal?

Rules:
- Default answer is YES. Only say NO if the image has zero conceivable connection to the goal.
- You are verifying effort and context, not perfection.
- Gym, workout clothes, weights, sweat = any fitness or exercise goal.
- Food, meals, cooking, grocery = any diet, nutrition, or cooking goal.
- Books, notes, screen with text, study desk = any study, reading, or learning goal.
- Outdoor scenery, running shoes, a path = any running, walking, or outdoor goal.
- A completed app screen, calendar, habit tracker = any productivity or habit goal.
- A blurry, dark, or partial image that hints at the activity = YES.
- When in doubt: YES.
- Only say NO if you can clearly describe what you see AND explain why it has absolutely no link to the goal.

Tone: second person, one sentence only. Never mention AI or technical systems.

Return ONLY valid JSON:
{"verified": true | false, "reason": "one sentence"}`;

const USER_PROMPT = (goal: string, milestone?: string) => {
  const lines: string[] = [`Goal: "${goal}"`];
  if (milestone && milestone !== goal) {
    lines.push(`Current step: "${milestone}"`);
  }
  lines.push(
    "",
    "Look at this image. Is there any connection — even loose or indirect — between what you see and this goal?",
    "",
    'Return exactly: {"verified": true | false, "reason": "one sentence in second person"}',
  );
  return lines.join("\n");
};

/** Fetch the image and return a base64 data URI so OpenAI doesn't have to hit IPFS gateways. */
async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, milestoneDescription, deluluGoal } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("imageUrl is required", 400);
    }

    if (!process.env.OPENAI_API_KEY) {
      return errorResponse("AI service not configured", 503);
    }

    // Use deluluGoal as primary context; fall back to milestoneDescription only if readable
    const rawGoal = typeof deluluGoal === "string" ? deluluGoal.trim() : "";
    const rawMilestone =
      typeof milestoneDescription === "string" ? milestoneDescription.trim() : "";
    const readableMilestone =
      rawMilestone.length >= 3 && !isIPFSHash(rawMilestone) ? rawMilestone : "";

    const goal =
      rawGoal.length >= 3
        ? rawGoal
        : readableMilestone.length >= 3
        ? readableMilestone
        : "";

    if (!goal) {
      return errorResponse("A valid goal or milestone description is required", 400);
    }

    console.log("[verify-milestone] request:", {
      goal,
      milestone: readableMilestone || "(none)",
      imageUrl: imageUrl.slice(0, 120),
    });

    // Download the image server-side so OpenAI never has to reach IPFS gateways
    let imagePayload: string;
    try {
      imagePayload = await toDataUri(imageUrl);
    } catch (fetchErr) {
      console.error("[verify-milestone] image fetch error:", fetchErr);
      return errorResponse("Could not download the image. Please try again.", 422);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imagePayload, detail: "auto" },
            },
            {
              type: "text",
              text: USER_PROMPT(goal, readableMilestone || undefined),
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    console.log("[verify-milestone] AI raw response:", raw);

    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as VerifyMilestoneResponse;

    if (typeof parsed.verified !== "boolean" || typeof parsed.reason !== "string") {
      return errorResponse("Invalid AI response format", 502);
    }

    console.log("[verify-milestone] result:", { verified: parsed.verified, reason: parsed.reason });

    return jsonResponse({
      verified: parsed.verified,
      reason: parsed.reason.slice(0, 300),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to verify milestone";
    console.error("[/api/ai/verify-milestone]", err);
    return errorResponse(message, 500);
  }
}
