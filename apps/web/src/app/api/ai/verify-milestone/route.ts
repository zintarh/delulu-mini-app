import { NextRequest } from "next/server";
import OpenAI from "openai";
import { errorResponse, jsonResponse } from "@/lib/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VerifyMilestoneResponse {
  verified: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are a lenient milestone proof reviewer for a personal goal-tracking app.

Your default answer is YES. Verify the image unless it is obviously, completely unrelated to the milestone.

How to decide:
- Ask yourself: "Could this image plausibly be from someone doing this activity?" If yes, verify it.
- Any image that shows the person in the right context, environment, or doing something related counts as proof. It does not need to be perfect or show the exact moment.
- Squatting in a gym = verified for any fitness or workout milestone.
- A plate of healthy food = verified for any nutrition or diet milestone.
- A textbook, notes, or learning app = verified for any study or language milestone.
- Outdoor photo = verified for running, walking, or outdoor activity milestones.
- A screenshot of a completed task, calendar, or tracker = verified for habit or productivity milestones.
- Blurry, dark, or partial images that still hint at the activity = verified.
- Only return verified: false if the image is completely and obviously unrelated — for example, a picture of a car for a cooking goal, or a pet photo for a coding goal.
- When in doubt, verify. It is better to approve an imperfect proof than to reject someone who genuinely did the work.

Tone:
- Address the user in second person ("your image", "you").
- If verified: one short sentence confirming what you see connects to the milestone.
- If rejected: one sentence saying what you see and why it has no connection to the milestone.
- Never mention AI, models, or technical systems.

Return ONLY valid JSON, no markdown.`;

const USER_PROMPT = (milestoneDescription: string) =>
  `Milestone: "${milestoneDescription}"

Look at this image. Is there any connection — even loose — between what you see and this milestone?

Return this exact JSON:
{
  "verified": true | false,
  "reason": "one sentence in second person"
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
      temperature: 0.1,
      max_tokens: 150,
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
