import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { verifyImageProof } from "@/lib/ai/verify-image-proof";
import {
  checkProofImages,
  recordProofImages,
  REJECT_COPY,
  type ProofContext,
  type ProofRejectCode,
} from "@/lib/proof-integrity/check";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type ProofReview =
  | { ok: true; reason: string | null }
  | { ok: false; code: ProofRejectCode; reason: string };

/**
 * The full proof gate both proof routes share: integrity checks (reused,
 * old, thumbnail), then — when `ai` is given — the AI review, then the
 * fingerprint record. Throws only when the AI service itself fails, so the
 * caller can answer "try again" instead of "rejected".
 */
export async function reviewProof(
  admin: SupabaseAdmin,
  ctx: ProofContext,
  urls: string[],
  opts: { liveCamera: boolean; ai: { goal: string; milestone?: string } | null },
): Promise<ProofReview> {
  const check = await checkProofImages(admin, ctx, urls, { liveCamera: opts.liveCamera });
  if (!check.ok) {
    await recordProofImages(admin, ctx, check.images, { status: "rejected", code: check.code });
    console.warn(`[proof-integrity] ${check.code} wallet=${ctx.wallet} ref=${ctx.refId}`);
    return { ok: false, code: check.code, reason: check.reason };
  }

  let reason: string | null = null;
  if (opts.ai) {
    // A phone camera wrote this photo's metadata and dated it within the last day: it's first-hand.
    const main = check.images[0];
    const cameraToday =
      !opts.liveCamera && main?.camera && main.takenAt && Date.now() - main.takenAt.getTime() <= 24 * 3_600_000 ? main.camera : null;
    const verdict = await verifyImageProof({
      cameraToday,
      imageUrl: opts.liveCamera ? urls : urls[0],
      goal: opts.ai.goal,
      milestone: opts.ai.milestone,
      images: opts.liveCamera ? check.images : [check.images[0]],
      compareWith: check.compareWith,
      tzOffsetMinutes: ctx.tzOffsetMinutes,
    });
    if (!verdict.verified) {
      const code: ProofRejectCode = verdict.sameAsPrevious ? "ai_same_as_previous" : "ai_rejected";
      const userReason = verdict.sameAsPrevious
        ? REJECT_COPY.same_as_previous(check.compareWith?.sameWallet ?? false)
        : verdict.reason.trim() || "Your proof wasn't accepted. Take a clear photo of what you did today.";
      await recordProofImages(admin, ctx, check.images, {
        status: "rejected",
        code,
        note: `${verdict.issue ?? ""}: ${verdict.reason}`,
      });
      return { ok: false, code, reason: userReason };
    }
    reason = verdict.reason;
  }

  await recordProofImages(admin, ctx, check.images, { status: "accepted" });
  return { ok: true, reason };
}
