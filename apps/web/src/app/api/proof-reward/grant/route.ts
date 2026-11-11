import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import type { ProofRewardKind } from "@/lib/proof-reward/grant";
import { processVerifiedProof } from "@/lib/rewards/engine";

export const dynamic = "force-dynamic";
// Waits (within a 45s budget) for the RewardVault credits to mine so the
// success card can offer the claim straight away; anything slower is left
// 'submitted' and settled by /api/cron/rewards-payouts.
export const maxDuration = 60;

/**
 * Runs the Rewards Engine for an on-chain proof tx: daily proof reward,
 * weekly consistency bonus, and campaign completion. No wallet in the body
 * on purpose: the recipient is always re-derived from the tx itself (see
 * processVerifiedProof), so calling this for someone else's proof can only
 * ever pay that someone — never the caller. Idempotent, so retries are safe.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const kind = body.kind as ProofRewardKind;
  const proofTxHash = String(body.proofTxHash ?? "").trim();

  if (kind !== "campaign" && kind !== "forfeit") {
    return NextResponse.json({ error: "Kind must be campaign or forfeit" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(proofTxHash)) {
    return NextResponse.json({ error: "Proof tx hash is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  try {
    const result = await processVerifiedProof(admin, {
      kind,
      proofTxHash: proofTxHash as `0x${string}`,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[proof-reward/grant] error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
