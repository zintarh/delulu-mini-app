import { NextRequest, NextResponse } from "next/server";
import { parseVerifierInviteAcceptedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Called by the invited friend's client right after their own
 * `acceptVerifierInvite` tx confirms. Independently re-derives the
 * VerifierInviteAccepted event before touching Supabase — same tamper-resistant
 * pattern as confirm-create.
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
    parsed = await parseVerifierInviteAcceptedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (!parsed || parsed.verifier !== walletAddress) {
    return NextResponse.json(
      { error: "VerifierInviteAccepted event not found for this wallet." },
      { status: 400 },
    );
  }

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("on_chain_commitment_id", Number(parsed.commitmentId))
    .maybeSingle();

  if (!commitment) {
    return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
  }

  await admin
    .from("forfeit_commitments")
    .update({ verifier_wallet: walletAddress })
    .eq("id", commitment.id);

  await admin
    .from("forfeit_verifier_invites")
    .update({
      status: "accepted",
      resolved_wallet: walletAddress,
      accepted_at: new Date().toISOString(),
    })
    .eq("commitment_id", commitment.id);

  return NextResponse.json({ ok: true, commitmentId: commitment.id });
}
