import { NextRequest, NextResponse } from "next/server";
import {
  parsePeriodResolvedSuccessFromTx,
  parseProofSubmittedFromTx,
} from "@/lib/dashboard/parse-forfeit-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";

export const dynamic = "force-dynamic";

/**
 * Called by the creator's client right after submitProof (and, for self/ai
 * commitments, the immediately-following resolveCommitmentSuccess) confirm
 * on-chain. Independently re-derives both events from their tx receipts before
 * writing anything — same tamper-resistant pattern as confirm-create.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const proofTxHash = String(body.proofTxHash ?? "").trim() as `0x${string}`;
  const resolveTxHash = body.resolveTxHash ? (String(body.resolveTxHash).trim() as `0x${string}`) : null;
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  if (!proofTxHash.startsWith("0x")) {
    return NextResponse.json({ error: "proofTxHash is required" }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  let proofEvent;
  try {
    proofEvent = await parseProofSubmittedFromTx(proofTxHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read submit-proof transaction" },
      { status: 400 },
    );
  }
  if (!proofEvent || proofEvent.creator !== walletAddress) {
    return NextResponse.json({ error: "ProofSubmitted event not found for this wallet." }, { status: 400 });
  }

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, title, verifier_wallet, verification_method")
    .eq("on_chain_commitment_id", Number(proofEvent.commitmentId))
    .maybeSingle();
  if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });

  // Idempotent: a retried confirm for the same period just overwrites with the same data.
  await admin.from("forfeit_periods").upsert(
    {
      commitment_id: commitment.id,
      period_index: proofEvent.periodIndex,
      proof_url: proofEvent.proofLink,
      tx_hash: proofTxHash,
    },
    { onConflict: "commitment_id,period_index" },
  );

  let commitmentEnded = false;
  if (resolveTxHash) {
    let resolveEvent;
    try {
      resolveEvent = await parsePeriodResolvedSuccessFromTx(resolveTxHash);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to read resolve transaction" },
        { status: 400 },
      );
    }
    if (
      !resolveEvent ||
      resolveEvent.commitmentId !== proofEvent.commitmentId ||
      resolveEvent.periodIndex !== proofEvent.periodIndex ||
      resolveEvent.resolver !== walletAddress
    ) {
      return NextResponse.json(
        { error: "PeriodResolvedSuccess event not found for this wallet/period." },
        { status: 400 },
      );
    }
    commitmentEnded = resolveEvent.commitmentEnded;

    await admin
      .from("forfeit_periods")
      .update({ verifier_action: "approved", resolved_at: new Date().toISOString() })
      .eq("commitment_id", commitment.id)
      .eq("period_index", proofEvent.periodIndex);

    if (commitmentEnded) {
      await admin.from("forfeit_commitments").update({ status: "completed" }).eq("id", commitment.id);
    }
  } else if (commitment.verifier_wallet) {
    // Friend-verified: notify the verifier that proof is waiting for their review.
    await notifyManyRecipients(admin, [commitment.verifier_wallet], {
      title: "Proof submitted for review",
      body: `Proof was submitted for "${commitment.title}" — review it before the deadline.`,
      url: `/forfeit/verify/${proofEvent.commitmentId.toString()}`,
      type: "forfeit_proof_submitted",
      message: `Proof was submitted for **${commitment.title}**.`,
      eventKeyFor: (addr) => `forfeit_proof_submitted:${commitment.id}:${proofEvent.periodIndex}:${addr}`,
    }).catch((err) => {
      console.error("[forfeit/confirm-proof] verifier notification failed", err);
    });
  }

  return NextResponse.json({ ok: true, commitmentId: commitment.id, commitmentEnded });
}
