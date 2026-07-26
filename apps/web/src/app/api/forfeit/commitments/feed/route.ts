import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchBatchForfeitCommitmentState } from "@/lib/forfeit/forfeit-subgraph";

export const dynamic = "force-dynamic"; // address-specific, cannot be CDN-cached

type CommitmentRow = {
  id: string;
  on_chain_commitment_id: number | null;
  creator_wallet: string;
  title: string;
  description: string | null;
  evidence_type: string;
  verification_method: string;
  is_private: boolean;
  remind_enabled: boolean;
  verifier_wallet: string | null;
  status: string;
  created_at: string;
};

/**
 * Merges Supabase (descriptive metadata + workflow status) with the subgraph
 * (financial ground truth: stake, deadline, resolution state) — same split
 * the community-campaign feed uses. Scoped to one wallet's own commitments;
 * `role=verifier` returns commitments where this wallet is the named verifier
 * instead of the creator, for a future review UI.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const role = searchParams.get("role") === "verifier" ? "verifier" : "creator";

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const column = role === "verifier" ? "verifier_wallet" : "creator_wallet";
  const { data: rows, error } = await admin
    .from("forfeit_commitments")
    .select(
      "id, on_chain_commitment_id, creator_wallet, title, description, evidence_type, verification_method, is_private, remind_enabled, verifier_wallet, status, created_at",
    )
    .eq(column, address)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const commitments = (rows ?? []) as CommitmentRow[];
  const onChainIds = commitments
    .map((c) => c.on_chain_commitment_id)
    .filter((id): id is number => id != null);

  const onChainState = await fetchBatchForfeitCommitmentState(onChainIds).catch(() => new Map());

  const items = commitments.map((c) => {
    const chain = c.on_chain_commitment_id != null ? onChainState.get(c.on_chain_commitment_id) : undefined;
    return {
      id: c.id,
      onChainCommitmentId: c.on_chain_commitment_id,
      title: c.title,
      description: c.description,
      evidenceType: c.evidence_type,
      verificationMethod: c.verification_method,
      isPrivate: c.is_private,
      remindEnabled: c.remind_enabled,
      creatorWallet: c.creator_wallet,
      verifierWallet: c.verifier_wallet,
      status: c.status,
      createdAt: c.created_at,
      onChain: chain
        ? {
            stakeAmount: chain.stakeAmount,
            token: chain.token,
            destinationType: chain.destinationType,
            destinationAddr: chain.destinationAddr,
            cadence: chain.cadence,
            periodSeconds: chain.periodSeconds,
            totalPeriods: chain.totalPeriods,
            currentPeriodIndex: chain.currentPeriodIndex,
            currentPeriodDeadline: chain.currentPeriodDeadline,
            active: chain.active,
            cancelled: chain.cancelled,
            hasPendingVerifierInvite: chain.hasPendingVerifierInvite,
          }
        : null,
    };
  });

  return NextResponse.json({ items });
}
