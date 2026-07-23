import OpenAI from "openai";

export interface VerifyImageProofResult {
  verified: boolean;
  reason: string;
}

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

function userPrompt(goal: string, milestone?: string, imageCount = 1) {
  const lines: string[] = [`Goal: "${goal}"`];
  if (milestone && milestone !== goal) lines.push(`Current step: "${milestone}"`);
  const subject = imageCount > 1 ? "these images (frames from a short recording)" : "this image";
  lines.push(
    "",
    `Look at ${subject}. Is there any connection — even loose or indirect — between what you see and this goal?`,
    "",
    'Return exactly: {"verified": true | false, "reason": "one sentence in second person"}',
  );
  return lines.join("\n");
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function verifyImageProof(input: {
  imageUrl: string | string[];
  goal: string;
  milestone?: string;
}): Promise<VerifyImageProofResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI service not configured");
  }

  const urls = Array.isArray(input.imageUrl) ? input.imageUrl : [input.imageUrl];
  if (urls.length === 0) throw new Error("At least one image is required");

  const rawGoal = input.goal.trim();
  const rawMilestone = (input.milestone ?? "").trim();
  const readableMilestone =
    rawMilestone.length >= 3 && !isIPFSHash(rawMilestone) ? rawMilestone : "";
  const goal =
    rawGoal.length >= 3
      ? rawGoal
      : readableMilestone.length >= 3
        ? readableMilestone
        : "";

  if (!goal) throw new Error("A valid goal description is required");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000 });
  const imagePayloads = await Promise.all(urls.map((url) => toDataUri(url)));

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...imagePayloads.map((payload) => ({
            type: "image_url" as const,
            image_url: { url: payload, detail: "auto" as const },
          })),
          { type: "text", text: userPrompt(goal, readableMilestone || undefined, imagePayloads.length) },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from AI");

  const parsed = JSON.parse(raw) as VerifyImageProofResult;
  if (typeof parsed.verified !== "boolean" || typeof parsed.reason !== "string") {
    throw new Error("Invalid AI response format");
  }

  return {
    verified: parsed.verified,
    reason: parsed.reason.slice(0, 300),
  };
}
