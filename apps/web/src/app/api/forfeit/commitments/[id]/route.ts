import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchBatchForfeitCommitmentState } from "@/lib/forfeit/forfeit-subgraph";
import { resolveUsernameForAddress } from "@/lib/resolve-username";

export const dynamic = "force-dynamic";

/**
 * Single commitment, looked up by its on-chain commitment id (not the Supabase
 * row id) — this is what the verify page's URL carries, since that's what the
 * invite email and the contract both key off of. Deliberately unauthenticated:
 * an invited friend needs to see what they're being asked to verify before they
 * even connect a wallet.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const onChainCommitmentId = Number(id);
  if (!Number.isInteger(onChainCommitmentId) || onChainCommitmentId < 0) {
    return NextResponse.json({ error: "Invalid commitment id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: commitment, error } = await admin
    .from("forfeit_commitments")
    .select(
      "id, on_chain_commitment_id, creator_wallet, title, description, evidence_type, verification_method, verifier_wallet, status, created_at",
    )
    .eq("on_chain_commitment_id", onChainCommitmentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });

  const [creatorUsername, onChainStateMap] = await Promise.all([
    resolveUsernameForAddress(admin, commitment.creator_wallet),
    fetchBatchForfeitCommitmentState([onChainCommitmentId]).catch(() => new Map()),
  ]);

  const onChain = onChainStateMap.get(onChainCommitmentId) ?? null;

  const { data: currentPeriod } = onChain
    ? await admin
        .from("forfeit_periods")
        .select("proof_url, verifier_action, resolved_at")
        .eq("commitment_id", commitment.id)
        .eq("period_index", onChain.currentPeriodIndex)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    commitment: {
      id: commitment.id,
      onChainCommitmentId: commitment.on_chain_commitment_id,
      creatorWallet: commitment.creator_wallet,
      creatorUsername,
      title: commitment.title,
      description: commitment.description,
      evidenceType: commitment.evidence_type,
      verificationMethod: commitment.verification_method,
      verifierWallet: commitment.verifier_wallet,
      status: commitment.status,
      createdAt: commitment.created_at,
      onChain,
      currentPeriod: currentPeriod
        ? {
            proofUrl: currentPeriod.proof_url,
            verifierAction: currentPeriod.verifier_action,
            resolvedAt: currentPeriod.resolved_at,
          }
        : null,
    },
  });
}
