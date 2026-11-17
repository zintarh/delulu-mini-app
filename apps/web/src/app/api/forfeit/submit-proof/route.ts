import { bingoAttemptForCommitment } from "@/lib/bingo/rolling";
import { NextRequest, NextResponse } from "next/server";
import { reviewProof } from "@/lib/proof-integrity/review";
import { parseTzOffset } from "@/lib/proof-integrity/check";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { recordApprovedProof } from "@/lib/proof-reward/grant";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { DELULU_CHAIN_ID, getForfeitMarketAddress } from "@/lib/constant";
import { periodOpensAt } from "@/lib/forfeit/period-window";

const publicClient = createPublicClient({ chain: celo, transport: http() });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pre-flight for forfeit proof submission — runs the same AI image check
 * campaigns use (reviewProof: reused / old photo checks + AI) before the client ever spends gas on
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
  const tzOffsetMinutes = parseTzOffset(body.tzOffsetMinutes);

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
  // A Bingo card's goal: each day's photo is for a specific square, so it goes through the card.
  if (await bingoAttemptForCommitment(admin, onChainCommitmentId)) {
    return NextResponse.json({ error: "Add this photo from your Bingo card.", code: "use_bingo_card" }, { status: 409 });
  }
  if (commitment.creator_wallet !== walletAddress) {
    return NextResponse.json({ error: "Only the creator can submit proof for this forfeit." }, { status: 403 });
  }
  if (commitment.status !== "active") {
    return NextResponse.json({ error: "This forfeit isn't active anymore." }, { status: 400 });
  }

  // Next period not open yet — don't let one sitting cover two days. The
  // contract enforces this too once upgraded; this also stops the AI check
  // (and the proof reward row) from running for a period that hasn't started.
  let periodIndex: number;
  try {
    const c = (await publicClient.readContract({
      address: getForfeitMarketAddress(DELULU_CHAIN_ID),
      abi: FORFEIT_MARKET_ABI,
      functionName: "commitments",
      args: [BigInt(onChainCommitmentId)],
    })) as readonly unknown[];
    const opensAt = periodOpensAt({
      periodSeconds: c[6] as bigint,
      currentPeriodDeadline: c[7] as bigint,
      currentPeriodIndex: Number(c[8]),
    });
    periodIndex = Number(c[8]);
    if (opensAt) {
      return NextResponse.json(
        { error: "Today's proof is in. The next one opens when its day starts.", opensAt },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error("[forfeit/submit-proof] period window check failed", err);
    return NextResponse.json({ error: "Couldn't check your goal right now. Try again." }, { status: 503 });
  }

  const isLiveCamera = commitment.evidence_type === "camera";
  if (isLiveCamera && proofUrls.length < 2) {
    return NextResponse.json({ error: "At least 2 frames are required for live camera proof." }, { status: 400 });
  }
  if (!isLiveCamera && proofUrls.length !== 1) {
    return NextResponse.json({ error: "Exactly one proof image is required." }, { status: 400 });
  }

  // Self-verified goals never earn, so they skip the gate. Friend-verified
  // ones still get the integrity checks (no reused or old photos) since an
  // approval there earns too; only "ai" goals get the AI review.
  if (commitment.verification_method === "ai" || commitment.verification_method === "friend") {
    let review;
    try {
      review = await reviewProof(
        admin,
        {
          wallet: walletAddress,
          kind: "forfeit",
          refId: commitment.id,
          periodKey: `${commitment.id}:${periodIndex}`,
          tzOffsetMinutes,
        },
        proofUrls,
        {
          liveCamera: isLiveCamera,
          ai:
            commitment.verification_method === "ai"
              ? { goal: commitment.title, milestone: commitment.description ?? undefined }
              : null,
        },
      );
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

    if (!review.ok) {
      return NextResponse.json(
        { verified: false, code: review.code, reason: review.reason, error: review.reason },
        { status: 422 },
      );
    }

    if (commitment.verification_method === "ai") {
      // Lets the on-chain submission of this exact proof URL earn the per-proof
      // G$ rewards (see lib/rewards/engine.ts). Only AI-reviewed proofs get
      // a row here; friend-verified ones are gated on the friend's approval.
      await recordApprovedProof(admin, {
        wallet: walletAddress,
        kind: "forfeit",
        proofUrl: proofUrls[0],
        refId: commitment.id,
      });
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
