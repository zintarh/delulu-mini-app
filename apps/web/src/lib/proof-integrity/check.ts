import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { fingerprintImage, type ImageFingerprint } from "@/lib/proof-integrity/fingerprint";
import { readCaptureDate } from "@/lib/proof-integrity/capture-date";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** A photo must have been taken within this window to count as today's proof. */
export const MAX_PHOTO_AGE_MS = 24 * 60 * 60 * 1000;
/** Camera clocks drift; a capture time this far ahead is treated as unknown, not as fresh. */
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;
/** Shorter side below this is a thumbnail (e.g. an image-search result), not a camera photo or screenshot. */
const MIN_SIDE_PX = 320;
/**
 * dHash bits (of 256) within which an earlier image is a *candidate* copy.
 * Not a verdict: daily screenshots of one app also land close, so the AI
 * compares the two images and decides.
 */
const NEAR_DUPLICATE_BITS = 20;
const MAX_BYTES = 8 * 1024 * 1024;

export type ProofRejectCode =
  | "reused_own"
  | "reused_other"
  | "too_old"
  | "too_small"
  | "foreign_host"
  | "fetch_failed"
  | "ai_rejected"
  | "ai_same_as_previous";

export type ProofImage = {
  url: string;
  bytes: Buffer;
  contentType: string;
  fp: ImageFingerprint;
  takenAt: Date | null;
};

export type ProofContext = {
  wallet: string;
  kind: "campaign" | "forfeit";
  /** forfeit_commitments.id or community_campaigns.id */
  refId: string;
  /** The day this proof is for — see proof_image_fingerprints.period_key. */
  periodKey: string;
  /** Device zone, minutes east of UTC (-new Date().getTimezoneOffset()). */
  tzOffsetMinutes?: number | null;
};

export type IntegrityPass = {
  ok: true;
  images: ProofImage[];
  /** An earlier accepted image that looks close to images[0]: the AI must rule on it. */
  compareWith: { url: string; bytes: Buffer; contentType: string; sameWallet: boolean } | null;
};

export type IntegrityFail = {
  ok: false;
  code: ProofRejectCode;
  reason: string;
  images: ProofImage[];
};

function formatDay(date: Date, tzOffsetMinutes?: number | null): string {
  const shifted = new Date(date.getTime() + (tzOffsetMinutes ?? 0) * 60_000);
  return shifted.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export const REJECT_COPY = {
  reused_own: "You've used this photo before. Take a new one for today.",
  reused_other: "This photo has already been used on Delulu. Take your own photo today.",
  too_small: "This image is too small to check. Take a full photo with your camera.",
  foreign_host: "Upload your proof in the app and try again.",
  fetch_failed: "We couldn't load your proof image. Try uploading it again.",
  too_old: (taken: Date, tz?: number | null) =>
    `This photo was taken on ${formatDay(taken, tz)}. Use one taken in the last 24 hours.`,
  same_as_previous: (sameWallet: boolean) =>
    sameWallet
      ? "You've used this photo before. Take a new one for today."
      : "This photo has already been used on Delulu. Take your own photo today.",
} as const;

function storageHost(): string | null {
  try {
    return new URL(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || null;
  } catch {
    return null;
  }
}

async function fetchImage(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("image too large");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error("image too large");
  return { bytes, contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

type Match = { wallet: string; proof_url: string; exact: boolean; distance: number | null };

async function findMatches(admin: SupabaseAdmin, ctx: ProofContext, fp: ImageFingerprint): Promise<Match[]> {
  const { data, error } = await admin.rpc("find_proof_image_matches", {
    p_sha256: fp.sha256,
    p_dhash: fp.dhash,
    p_max_distance: NEAR_DUPLICATE_BITS,
    p_wallet: ctx.wallet,
    p_period_key: ctx.periodKey,
  });
  if (error) {
    // Fail open: a lookup outage must not stop people proving their goals
    // (stakes are on the line). The AI review still runs.
    console.error("[proof-integrity] match lookup failed", error);
    return [];
  }
  return (data ?? []) as Match[];
}

/**
 * Runs before the AI review. Rejects, with a reason the user sees:
 *  - an image already accepted for another day, goal or wallet (exact copy)
 *  - a photo whose camera timestamp is more than 24 hours old
 *  - a thumbnail-sized image
 * and flags a near-copy of an earlier image for the AI to compare.
 *
 * Live-camera frames are captured in the app, so only the exact-copy check
 * applies to them (it stops re-posting old frame URLs).
 */
export async function checkProofImages(
  admin: SupabaseAdmin,
  ctx: ProofContext,
  urls: string[],
  opts: { liveCamera: boolean },
): Promise<IntegrityPass | IntegrityFail> {
  const host = storageHost();
  if (host && urls.some((u) => { try { return new URL(u).host !== host; } catch { return true; } })) {
    return { ok: false, code: "foreign_host", reason: REJECT_COPY.foreign_host, images: [] };
  }

  let images: ProofImage[];
  try {
    images = await Promise.all(
      urls.map(async (url) => {
        const { bytes, contentType } = await fetchImage(url);
        const [fp, takenAt] = await Promise.all([
          fingerprintImage(bytes),
          opts.liveCamera ? Promise.resolve(null) : readCaptureDate(bytes, ctx.tzOffsetMinutes),
        ]);
        return { url, bytes, contentType, fp, takenAt };
      }),
    );
  } catch (err) {
    console.warn("[proof-integrity] fetch failed", err);
    return { ok: false, code: "fetch_failed", reason: REJECT_COPY.fetch_failed, images: [] };
  }

  // Exact copies, any frame.
  for (const img of images) {
    const exact = (await findMatches(admin, ctx, { ...img.fp, dhash: null })).find((m) => m.exact);
    if (exact) {
      const own = exact.wallet === ctx.wallet;
      return { ok: false, code: own ? "reused_own" : "reused_other", reason: own ? REJECT_COPY.reused_own : REJECT_COPY.reused_other, images };
    }
  }

  if (opts.liveCamera) return { ok: true, images, compareWith: null };

  const main = images[0];
  if (main.fp.width != null && main.fp.height != null && Math.min(main.fp.width, main.fp.height) < MIN_SIDE_PX) {
    return { ok: false, code: "too_small", reason: REJECT_COPY.too_small, images };
  }

  if (main.takenAt) {
    const age = Date.now() - main.takenAt.getTime();
    if (age > MAX_PHOTO_AGE_MS) {
      return { ok: false, code: "too_old", reason: REJECT_COPY.too_old(main.takenAt, ctx.tzOffsetMinutes), images };
    }
    if (age < -FUTURE_TOLERANCE_MS) main.takenAt = null;
  }

  let compareWith: IntegrityPass["compareWith"] = null;
  if (main.fp.dhash) {
    const near = (await findMatches(admin, ctx, main.fp)).find((m) => !m.exact && m.distance != null);
    if (near) {
      try {
        const prev = await fetchImage(near.proof_url);
        compareWith = { url: near.proof_url, ...prev, sameWallet: near.wallet === ctx.wallet };
      } catch {
        // Earlier image gone from storage — nothing to compare against.
      }
    }
  }

  return { ok: true, images, compareWith };
}

/** Saves the review outcome. Accepted rows block future reuse; rejected rows are for abuse review. */
export async function recordProofImages(
  admin: SupabaseAdmin,
  ctx: ProofContext,
  images: ProofImage[],
  outcome: { status: "accepted" } | { status: "rejected"; code: ProofRejectCode; note?: string },
): Promise<void> {
  if (images.length === 0) return;
  const { error } = await admin.from("proof_image_fingerprints").insert(
    images.map((img) => ({
      wallet: ctx.wallet,
      kind: ctx.kind,
      ref_id: ctx.refId,
      period_key: ctx.periodKey,
      proof_url: img.url,
      sha256: img.fp.sha256,
      dhash: img.fp.dhash,
      width: img.fp.width,
      height: img.fp.height,
      taken_at: img.takenAt?.toISOString() ?? null,
      status: outcome.status,
      reject_code: outcome.status === "rejected" ? outcome.code : null,
      reject_note: outcome.status === "rejected" ? (outcome.note ?? null)?.slice(0, 300) ?? null : null,
    })),
  );
  if (error) console.error("[proof-integrity] could not record fingerprints", error);
}

export function parseTzOffset(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.round(n) : null;
}
