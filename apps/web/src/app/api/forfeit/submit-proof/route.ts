import { NextRequest, NextResponse } from "next/server";
import { verifyImageProof } from "@/lib/ai/verify-image-proof";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pre-flight for forfeit proof submission — runs the same AI image check
 * campaigns use (verifyImageProof) before the client ever spends gas on
 * submitProof/resolveCommitmentSuccess. Only gates the "ai" verification
 * method; "self" and "friend" commitments skip straight to on-chain since
 * either the creator vouches for themselves or a human verifier reviews it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const onChainCommitmentId = Number(body.onChainCommitmentId);
  const proofUrls = Array.isArray(body.proofUrls)
    ? body.proofUrls.map((u: unknown) => String(u).trim()).filter(Boolean)
    : [];

  if (!walletAddress) {
    return NextResponse.json({ error: "Connect your wallet to submit proof." }, { status: 400 });
  }
  if (!Number.isInteger(onChainCommitmentId) || onChainCommitmentId < 0) {
    return NextResponse.json({ error: "Invalid commitment id" }, { status: 400 });
  }
  if (proofUrls.length === 0) {
    return NextResponse.json({ error: "No proof was received. Try again." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, creator_wallet, title, description, evidence_type, verification_method, status")
    .eq("on_chain_commitment_id", onChainCommitmentId)
    .maybeSingle();

  if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
  if (commitment.creator_wallet !== walletAddress) {
    return NextResponse.json({ error: "Only the creator can submit proof for this forfeit." }, { status: 403 });
  }
  if (commitment.status !== "active") {
    return NextResponse.json({ error: "This forfeit isn't active anymore." }, { status: 400 });
  }

  const isLiveCamera = commitment.evidence_type === "camera";
  if (isLiveCamera && proofUrls.length < 2) {
    return NextResponse.json({ error: "At least 2 frames are required for live camera proof." }, { status: 400 });
  }
  if (!isLiveCamera && proofUrls.length !== 1) {
    return NextResponse.json({ error: "Exactly one proof image is required." }, { status: 400 });
  }

  if (commitment.verification_method === "ai") {
    let verdict;
    try {
      verdict = await verifyImageProof({
        imageUrl: isLiveCamera ? proofUrls : proofUrls[0],
        goal: commitment.title,
        milestone: commitment.description ?? undefined,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Verification failed";
      const friendly =
        /ai service not configured/i.test(raw)
          ? "Proof review is temporarily unavailable. Please try again later."
          : /image fetch failed/i.test(raw)
            ? "We couldn't load your proof images. Please try uploading again."
            : raw.length > 0 && raw.length < 180
              ? raw
              : "Proof review failed. Check your connection and try again.";
      return NextResponse.json({ error: friendly }, { status: 503 });
    }

    if (!verdict.verified) {
      const reason =
        (verdict.reason && String(verdict.reason).trim()) ||
        "Your proof wasn't accepted. Try a clearer photo that shows the activity.";
      return NextResponse.json(
        { verified: false, reason, error: reason },
        { status: 422 },
      );
    }
  }

  // "self" and "friend" methods aren't AI-gated: resolveCommitmentSuccess itself
  // is only callable by the creator (self) or the named verifier (friend), so
  // the contract is the actual gate — this endpoint just records the proof link.
  return NextResponse.json({
    verified: true,
    requiresOnChain: true,
    onChainCommitmentId,
    proofUrl: proofUrls[0],
    // Only self/ai commitments let the creator resolve success themselves right
    // after submitting proof — a friend-verified commitment must wait for the
    // named verifier to call resolveCommitmentSuccess from the verify page.
    canAutoResolve: commitment.verification_method !== "friend",
  });
}
