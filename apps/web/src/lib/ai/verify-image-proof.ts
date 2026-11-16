import OpenAI from "openai";

export interface VerifyImageProofResult {
  verified: boolean;
  reason: string;
  /** Set when an earlier image was passed in `compareWith` and the AI judged it the same photo. */
  sameAsPrevious?: boolean;
  /** Why it was rejected, for abuse review. "none" when verified. */
  issue?: string;
}

type ImageInput = { bytes: Buffer; contentType: string };

function isIPFSHash(str: string): boolean {
  return (
    str.startsWith("Qm") ||
    str.startsWith("bafy") ||
    str.startsWith("ipfs://") ||
    (str.length > 40 && /^[a-f0-9]+$/i.test(str))
  );
}

const SYSTEM_PROMPT = `You review photo proof for a habit app where people earn money for doing their daily goal. Some people try to cheat with photos that aren't theirs or aren't from today. Your job is to tell a genuine, first-hand proof from a fake one.

ACCEPT when the image is plausibly something this person captured themselves, recently, showing the goal's activity:
- A casual phone photo of the activity, its result, or its setting (a book open on a desk, a plate of food, a gym, a running route, a workout tracker).
- A screenshot of their own app or device that shows the activity (step counter, fitness app, reading app, study timer, their own social post) — only when the goal is something you'd naturally prove with a screenshot.
- Quality does not matter: blurry, dark, tilted, partial or messy photos are fine if they look genuinely first-hand.

REJECT when any of these is true:
- stock: a professional, posed, studio-lit or model-style photo, a marketing or product shot, or anything that looks taken from the internet or an image search (watermarks, stock-site styling, perfect composition with a model, very low-resolution thumbnail).
- generated: it looks AI-generated, a render, an illustration, a meme or a graphic.
- not_first_hand: a photo of another screen showing someone else's photo, a screenshot of someone else's content, or a screenshot of a social post, chat or app that is not clearly the user's own activity.
- old: ONLY for a screenshot of a post, chat, receipt or app whose own timestamp is clearly readable and is more than one day BEFORE today's date. Never use "old" for a camera photo, for dates printed on posters, books, flyers or packaging, for page numbers, for future dates, or when no date is clearly readable — none of those say when the proof was made.
- unrelated: no real connection to the goal.

If you are unsure whether the image is genuine, prefer rejecting with a clear, friendly tip about what photo to take instead.

Reason: one short sentence, second person, plain words, never mention AI, rules or cheating. On rejection say what to send instead.

Return ONLY valid JSON:
{"verified": true | false, "issue": "none" | "stock" | "generated" | "not_first_hand" | "old" | "unrelated" | "unclear", "reason": "one sentence"}`;

const SAME_PHOTO_PROMPT = `You compare two images. Image A is a new upload. Image B was uploaded earlier.

Answer whether A is the SAME capture as B: the same photo or screenshot, even if resized, cropped, re-compressed, filtered, brightened, rotated or screenshotted again.

A NEW photo of a similar scene, the same room, the same dish, the same book or the same app screen with any different content, numbers, text, angle, lighting or moment is NOT the same.

Return ONLY valid JSON: {"same": true | false}`;

function userPrompt(input: {
  goal: string;
  milestone?: string;
  imageCount: number;
  today: string;
}) {
  const lines: string[] = [`Goal: "${input.goal}"`];
  if (input.milestone && input.milestone !== input.goal) lines.push(`Current step: "${input.milestone}"`);
  lines.push(`Today's date: ${input.today}`);
  const subject =
    input.imageCount > 1 ? `these ${input.imageCount} images (frames from a live recording in the app)` : "this image";
  lines.push("", `Review ${subject} as today's proof for this goal.`);
  lines.push("", 'Return exactly: {"verified": true | false, "issue": "...", "reason": "one sentence"}');
  return lines.join("\n");
}

async function urlToImage(url: string): Promise<ImageInput> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error("We couldn't load your proof images. Please try uploading again.");
  }
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

const toDataUri = (img: ImageInput) => `data:${img.contentType};base64,${img.bytes.toString("base64")}`;

export async function verifyImageProof(input: {
  imageUrl: string | string[];
  goal: string;
  milestone?: string;
  /** Already-downloaded bytes for `imageUrl`, same order — skips a second fetch. */
  images?: ImageInput[];
  /** An earlier accepted proof that looks close: the AI decides if it's the same photo. */
  compareWith?: ImageInput | null;
  /** The user's device zone (minutes east of UTC), for "today" in visible dates. */
  tzOffsetMinutes?: number | null;
}): Promise<VerifyImageProofResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Proof review is temporarily unavailable. Please try again later.");
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
  const images =
    input.images && input.images.length === urls.length ? input.images : await Promise.all(urls.map(urlToImage));

  const today = new Date(Date.now() + (input.tzOffsetMinutes ?? 0) * 60_000).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: toDataUri(img), detail: "auto" as const },
          })),
          {
            type: "text",
            text: userPrompt({
              goal,
              milestone: readableMilestone || undefined,
              imageCount: images.length,
              today,
            }),
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from AI");

  const parsed = JSON.parse(raw) as { verified?: unknown; reason?: unknown; issue?: unknown };
  if (typeof parsed.verified !== "boolean" || typeof parsed.reason !== "string") {
    throw new Error("Invalid AI response format");
  }
  const issue = typeof parsed.issue === "string" ? parsed.issue : parsed.verified ? "none" : "unclear";
  const verdict: VerifyImageProofResult = { verified: parsed.verified, reason: parsed.reason.slice(0, 300), issue };

  // Only a proof that passes on its own needs the copy check.
  if (verdict.verified && input.compareWith) {
    const same = await isSamePhoto(openai, images[0], input.compareWith);
    if (same) return { verified: false, reason: verdict.reason, issue: "same_as_previous", sameAsPrevious: true };
  }
  return { ...verdict, sameAsPrevious: false };
}

/** Separate call: judging "same photo?" alongside "valid proof?" muddles both answers. */
async function isSamePhoto(openai: OpenAI, current: ImageInput, previous: ImageInput): Promise<boolean> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SAME_PHOTO_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Image A (new):" },
          { type: "image_url", image_url: { url: toDataUri(current), detail: "auto" } },
          { type: "text", text: "Image B (earlier):" },
          { type: "image_url", image_url: { url: toDataUri(previous), detail: "auto" } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 20,
    response_format: { type: "json_object" },
  });
  try {
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}").same === true;
  } catch {
    return false;
  }
}
