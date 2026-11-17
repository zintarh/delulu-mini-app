import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { loadAttempt, recountAttempt } from "@/lib/bingo/attempts";
import { parseCommunityMilestoneProofSubmittedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { parsePeriodResolvedSuccessFromTx, parseProofSubmittedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { bonusTierKey } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TX = /^0x[0-9a-f]{64}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Fills a required square once its on-chain proof is verified — right
 * contract, wallet, day and photo. Weekly cards: the CommunityMarket proof tx.
 * Rolling cards: the ForfeitMarket proof tx plus the success resolve of that day.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const squareIndex = Number(body.squareIndex);
  const txHash = String(body.txHash ?? "").trim().toLowerCase();
  const resolveTxHash = String(body.resolveTxHash ?? "").trim().toLowerCase();
  if (!Number.isInteger(squareIndex) || !TX.test(txHash)) return bad("Missing square or transaction.");

  const admin = getSupabaseAdmin();
  if (!admin) return bad("DB unavailable", 500);

  const attempt = await loadAttempt(admin, id);
  if (!attempt || attempt.wallet !== wallet) return bad("This Bingo card isn't yours.", 403);

  const { data: square } = await admin
    .from("bingo_squares")
    .select("id, status, slot_index, proof_url, bonus")
    .eq("attempt_id", attempt.id)
    .eq("square_index", squareIndex)
    .maybeSingle();
  if (!square) return bad("Submit a photo for this square first.", 404);
  if (square.status === "filled") return NextResponse.json({ filled: true });

  try {
    if (attempt.cycle_id == null) {
      if (!TX.test(resolveTxHash) || attempt.forfeit_commitment_id == null) return bad("Missing transaction.");
      const [proof, resolved] = await Promise.all([
        parseProofSubmittedFromTx(txHash as `0x${string}`),
        parsePeriodResolvedSuccessFromTx(resolveTxHash as `0x${string}`),
      ]);
      const cid = String(attempt.forfeit_commitment_id);
      const ok =
        proof &&
        resolved &&
        proof.commitmentId.toString() === cid &&
        resolved.commitmentId.toString() === cid &&
        proof.creator === wallet &&
        resolved.resolver === wallet &&
        proof.periodIndex === square.slot_index &&
        // The contract emits the index after advancing, except on the final period.
        (resolved.periodIndex === square.slot_index || resolved.periodIndex === (square.slot_index ?? -1) + 1) &&
        proof.proofLink === square.proof_url;
      if (!ok) return bad("Those transactions aren't the proof for this square.");
    } else {
      if (!attempt.tier) return bad("This Bingo card isn't yours.", 403);
      // Bonus squares are proven on their own free campaign, milestone 0.
      let expectChallenge = attempt.tier.on_chain_challenge_id;
      let expectMilestone = square.slot_index;
      if (square.bonus) {
        const { data: bt } = await admin
          .from("bingo_cycle_tiers")
          .select("on_chain_challenge_id")
          .eq("cycle_id", attempt.cycle_id)
          .eq("tier_key", bonusTierKey(squareIndex))
          .maybeSingle();
        expectChallenge = bt?.on_chain_challenge_id ?? null;
        expectMilestone = 0;
      }
      const event = await parseCommunityMilestoneProofSubmittedFromTx(txHash as `0x${string}`);
      if (
        !event ||
        expectChallenge == null ||
        Number(event.challengeId) !== Number(expectChallenge) ||
        event.participant !== wallet ||
        Number(event.milestoneId) !== expectMilestone ||
        event.proofLink !== square.proof_url
      ) {
        return bad("That transaction isn't the proof for this square.");
      }
    }
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Couldn't read the transaction.");
  }

  const { error } = await admin
    .from("bingo_squares")
    .update({ status: "filled", proof_tx: txHash, filled_at: new Date().toISOString() })
    .eq("id", square.id)
    .eq("status", "confirming");
  if (error) return bad("Couldn't save your square. Try again.", 500);

  await recountAttempt(admin, attempt.id);
  const { data: fresh } = await admin.from("bingo_attempts").select("squares_filled, required_filled").eq("id", attempt.id).single();
  return NextResponse.json({ filled: true, squaresFilled: fresh?.squares_filled ?? null, requiredFilled: fresh?.required_filled ?? null });
}
