import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VerifyMilestoneResponse {
  verified: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are a strict but fair milestone proof reviewer for a goal-tracking app.

Your job is to determine whether a submitted image proves that a specific milestone was completed.

Rules:
- Only return verified: true if the image clearly and directly demonstrates the milestone was completed.
- Be strict: a vague, unrelated, or insufficient image should return verified: false.
- Be fair: if the evidence is reasonable and clearly matches the milestone, return verified: true.
- Judge only what is visually present — do not make assumptions.
- Write the reason in second person, directly addressing the user ("your image", "you").
- If rejected: name what you actually see in the image, explain specifically why it doesn't prove the milestone, and state what kind of image would be accepted.
- If approved: briefly describe what visible evidence confirms the milestone was completed.
- Keep the reason to one or two plain sentences. Never mention AI, verification systems, or technical terms.

Return ONLY valid JSON, no markdown.`;

const USER_PROMPT = (milestoneDescription: string) =>
  `Milestone to verify: "${milestoneDescription}"

Does this image prove the milestone was completed?

Return this exact JSON:
{
  "verified": true | false,
  "reason": "one or two sentences addressing the user directly — describe what you see and why it does or doesn't prove the milestone"
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
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: USER_PROMPT(milestoneDescription.trim()),
            },
          ],
        },
      ],
      temperature: 0.2,
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
