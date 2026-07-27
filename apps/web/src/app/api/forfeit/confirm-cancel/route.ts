import { NextRequest, NextResponse } from "next/server";
import { parseCommitmentCancelledFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Called by the creator's client right after their own cancelCommitment tx
 * confirms. Independently re-derives the CommitmentCancelled event before
 * touching Supabase — same tamper-resistant pattern as confirm-create.
 * Discontinuing forfeits the stake (see ForfeitMarket.cancelCommitment) — this
 * only marks the row cancelled so it stops showing in the creator's feed.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim() as `0x${string}`;
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  let parsed;
  try {
    parsed = await parseCommitmentCancelledFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }
  if (!parsed) {
    return NextResponse.json({ error: "CommitmentCancelled event not found." }, { status: 400 });
  }

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, creator_wallet")
    .eq("on_chain_commitment_id", Number(parsed.commitmentId))
    .maybeSingle();
  if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
  if (commitment.creator_wallet !== walletAddress) {
    return NextResponse.json({ error: "Only the creator can discontinue this forfeit." }, { status: 403 });
  }

  await admin.from("forfeit_commitments").update({ status: "cancelled" }).eq("id", commitment.id);

  return NextResponse.json({ ok: true, commitmentId: commitment.id });
}
