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
 *
 * `proofTxHash` is optional: the friend-verify page (/forfeit/verify/[id])
 * only ever calls resolveCommitmentSuccess itself — the proof was submitted
 * earlier by the creator, in a transaction the verifier's client never saw —
 * so it calls this with just `resolveTxHash`. PeriodResolvedSuccess alone
 * carries commitmentId/periodIndex, so the period row can still be looked up
 * and marked approved without re-deriving the (already-recorded) proof link.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const proofTxHash = body.proofTxHash ? (String(body.proofTxHash).trim() as `0x${string}`) : null;
  const resolveTxHash = body.resolveTxHash ? (String(body.resolveTxHash).trim() as `0x${string}`) : null;
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  if (!proofTxHash && !resolveTxHash) {
    return NextResponse.json({ error: "proofTxHash or resolveTxHash is required" }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  if (!proofTxHash) {
    return confirmResolveOnly(admin, resolveTxHash!, walletAddress);
  }

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
    // Contract currently emits PeriodResolvedSuccess after bumping currentPeriodIndex
    // for repeating commitments, so the emitted period can be proofPeriod+1.
    // Accept both shapes to keep confirm-proof backward compatible.
    const periodMatches =
      resolveEvent &&
      (resolveEvent.periodIndex === proofEvent.periodIndex ||
        resolveEvent.periodIndex === proofEvent.periodIndex + 1);

    if (
      !resolveEvent ||
      resolveEvent.commitmentId !== proofEvent.commitmentId ||
      !periodMatches ||
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

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Friend-verify path: only a resolveCommitmentSuccess tx exists (the caller
 * never submitted proof themselves), so re-derive commitmentId/periodIndex
 * straight from PeriodResolvedSuccess and just mark that period approved —
 * the proof_url/tx_hash columns are left as whatever the creator's earlier
 * submit-proof confirm already wrote.
 */
async function confirmResolveOnly(
  admin: SupabaseAdmin,
  resolveTxHash: `0x${string}`,
  walletAddress: string,
) {
  let resolveEvent;
  try {
    resolveEvent = await parsePeriodResolvedSuccessFromTx(resolveTxHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read resolve transaction" },
      { status: 400 },
    );
  }
  if (!resolveEvent || resolveEvent.resolver !== walletAddress) {
    return NextResponse.json(
      { error: "PeriodResolvedSuccess event not found for this wallet." },
      { status: 400 },
    );
  }

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("on_chain_commitment_id", Number(resolveEvent.commitmentId))
    .maybeSingle();
  if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });

  // Contract emits PeriodResolvedSuccess after bumping currentPeriodIndex for
  // repeating commitments — the approved period is the one just before it,
  // never negative since a resolve can't fire on period 0's predecessor.
  const approvedPeriodIndex = Math.max(0, resolveEvent.periodIndex - (resolveEvent.commitmentEnded ? 0 : 1));

  // Idempotent: upsert rather than update-only, so this still records the
  // approval even if the creator's submit-proof confirm never landed a row
  // for this period (e.g. that request failed after the on-chain tx).
  await admin.from("forfeit_periods").upsert(
    {
      commitment_id: commitment.id,
      period_index: approvedPeriodIndex,
      verifier_action: "approved",
      resolved_at: new Date().toISOString(),
    },
    { onConflict: "commitment_id,period_index" },
  );

  if (resolveEvent.commitmentEnded) {
    await admin.from("forfeit_commitments").update({ status: "completed" }).eq("id", commitment.id);
  }

  return NextResponse.json({
    ok: true,
    commitmentId: commitment.id,
    commitmentEnded: resolveEvent.commitmentEnded,
  });
}
