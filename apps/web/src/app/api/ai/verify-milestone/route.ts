import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VerifyMilestoneResponse {
  verified: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are a milestone proof reviewer for a personal goal-tracking app. Your job is to decide whether a submitted image is reasonable evidence that someone worked on or completed their milestone.

Core philosophy — give the benefit of the doubt:
- People proving effort don't always capture the perfect moment. Contextual evidence is enough: a gym or workout setting proves a fitness goal happened, a meal or food prep proves a nutrition goal, a language app or textbook proves a study session, a running route or fitness tracker proves cardio, a finished page or notes prove a reading goal, and so on.
- You DO NOT need to verify the exact duration, quantity, or outcome. Showing up and doing the thing is sufficient.
- Use common sense to connect the scene to the goal: gym equipment or workout clothes = fitness, food or cooking = nutrition, books, apps, or notes = learning, outdoor trail = running or walking, etc.
- Imperfect images (blurry, dark, partial) that still show the activity context should pass.
- Only reject if the image has absolutely no plausible connection to the milestone — for example, a selfie at a restaurant submitted for a gym goal, or a screenshot of a video game for a language learning goal.

Writing rules:
- Address the user in second person ("your image shows", "you appear to be").
- If approved: one sentence describing what you see that connects to the milestone.
- If rejected: one or two sentences describing what you actually see and why it has no connection to the stated milestone.
- Never mention AI, vision models, or any technical terms.

Return ONLY valid JSON, no markdown.`;

const USER_PROMPT = (milestoneDescription: string) =>
  `Milestone: "${milestoneDescription}"

Does this image show reasonable evidence that the person worked on or completed this milestone?

Return this exact JSON:
{
  "verified": true | false,
  "reason": "one or two sentences in second person describing what you see and whether it connects to the milestone"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, milestoneDescription } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("imageUrl is required", 400);
    }

    if (!milestoneDescription || typeof milestoneDescription !== "string" || milestoneDescription.trim().length < 3) {
      return errorResponse("A valid milestoneDescription is required", 400);
    }

    if (!process.env.OPENAI_API_KEY) {
      return errorResponse("AI service not configured", 503);
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
              image_url: { url: imageUrl, detail: "auto" },
            },
            {
              type: "text",
              text: USER_PROMPT(milestoneDescription.trim()),
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return errorResponse("No response from AI", 502);

    const parsed = JSON.parse(raw) as VerifyMilestoneResponse;

    if (typeof parsed.verified !== "boolean" || typeof parsed.reason !== "string") {
      return errorResponse("Invalid AI response format", 502);
    }

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
