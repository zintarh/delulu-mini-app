import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { grantProofReward, type ProofRewardKind } from "@/lib/proof-reward/grant";

export const dynamic = "force-dynamic";
// Waits for the RewardVault deposit to mine so the success card can offer
// the claim straight away.
export const maxDuration = 60;

/**
 * Grants the per-proof G$ reward for an on-chain proof tx. No wallet in the
 * body on purpose: the recipient is always re-derived from the tx itself
 * (see grantProofReward), so calling this for someone else's proof can only
 * ever pay that someone — never the caller.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const kind = body.kind as ProofRewardKind;
  const proofTxHash = String(body.proofTxHash ?? "").trim();

  if (kind !== "campaign" && kind !== "forfeit") {
    return NextResponse.json({ error: "kind must be campaign or forfeit" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(proofTxHash)) {
    return NextResponse.json({ error: "proofTxHash is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  try {
    const result = await grantProofReward(admin, {
      kind,
      proofTxHash: proofTxHash as `0x${string}`,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[proof-reward/grant] error:", err);
    return NextResponse.json({ status: "failed", amount: 0 }, { status: 500 });
  }
}
