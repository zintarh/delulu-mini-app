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

const SYSTEM_PROMPT = `You review photo proof for a habit app where people earn money for doing their daily goal. Most people are honest and take quick photos on their phone. Your job is to stop the few who use images that clearly aren't theirs — not to judge photo quality or style.

ACCEPT when the image plausibly shows the person doing, finishing or being around today's goal:
- Any casual or well-taken phone photo of the activity, its result or its setting (a meal, a plate, a book, a gym, a street, the sky, an outfit). Good lighting, a nice angle or a pretty dish is NOT a reason to reject — phones take good photos.
- A screenshot of an app, tracker or social media post that shows the activity. Treat a social post as the person's own unless it clearly says otherwise.
- Blurry, dark, tilted or messy photos are fine.
- Be generous about relevance: a meal counts for any eating or diet goal, any walk or run for an exercise goal, any page of a book for a reading goal. Only the gist has to match.

REJECT only with concrete evidence:
- stock: a watermark, stock-site or shop styling, a white-background product shot, a model posing in a studio, an ad or poster, text overlays like a web page, or a screenshot of an image search. "Looks professional" alone is NOT evidence.
- generated: AI-generated or rendered images, illustrations, cartoons or memes. AI images of "people doing the goal" are common cheats — tell-tales: a scene staged for the camera around the goal itself (motivational signs or labels like "Save Money", "Dream Big", "Savings" jars, neat props spelling out the habit), flawless glossy skin and lighting, a posed person smiling at the habit, or a too-perfect picture-book composition. Real proof looks like everyday life, not an ad for the habit.
- not_first_hand: clearly someone else's content — e.g. a photo of a TV or another person's screen, or a post whose visible name says it belongs to a brand or celebrity.
- old: ONLY a screenshot whose own timestamp is clearly readable and is more than one day BEFORE today's date. Never for camera photos, printed dates, page numbers or future dates.
- unrelated: has nothing at all to do with the goal (e.g. a random selfie for a reading goal).

If you are unsure, ACCEPT. A wrong rejection hurts an honest person; the app has other checks for copied images.

Reason: one short, friendly sentence, second person, plain words, never mention AI, rules or cheating. On rejection say what photo to take instead.

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
  cameraToday?: string | null;
}) {
  const lines: string[] = [`Goal: "${input.goal}"`];
  if (input.milestone && input.milestone !== input.goal) lines.push(`Current step: "${input.milestone}"`);
  lines.push(`Today's date: ${input.today}`);
  if (input.cameraToday) {
    lines.push(
      `The photo's own data shows it was taken today on a phone camera (${input.cameraToday}). It is first-hand: do not reject it as stock, not_first_hand or old — only check that it relates to the goal.`,
    );
  }
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
  /** EXIF says a phone camera took this photo today (maker/model) — trust it as first-hand. */
  cameraToday?: string | null;
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
              cameraToday: input.cameraToday,
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
  let verdict: VerifyImageProofResult = { verified: parsed.verified, reason: parsed.reason.slice(0, 300), issue };
  // The photo's own data already proves "taken today on a phone": a style guess can't overrule that,
  // and "unclear" means unsure, which accepts.
  if (!verdict.verified && (issue === "unclear" || (input.cameraToday && ["stock", "not_first_hand", "old"].includes(issue)))) {
    verdict = { verified: true, reason: "Nice — proof logged.", issue: `overruled_${issue}` };
  }

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
