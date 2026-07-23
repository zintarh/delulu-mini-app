import { NextRequest, NextResponse } from "next/server";
import { getAddress, type Address, type Hex } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getProofForWinner, type PayoutWinnerRow } from "@/lib/community/build-payout-snapshot";

export const dynamic = "force-dynamic";

/**
 * GET /api/community/campaigns/[id]/claim?address=0x...
 * Returns merkle claim data for a winner on an ended campaign.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const addressRaw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!addressRaw.startsWith("0x") || addressRaw.length < 42) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  let wallet: Address;
  try {
    wallet = getAddress(addressRaw as Address);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(
      "id, status, on_chain_challenge_id, payout_merkle_root, payout_total_claimable_wei, payout_published_at, proposed_pool_amount, prize_winner_count",
    )
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "ended") {
    return NextResponse.json({
      eligible: false,
      reason: "Campaign has not ended yet.",
    });
  }
  if (!campaign.payout_merkle_root || !campaign.payout_published_at) {
    return NextResponse.json({
      eligible: false,
      reason: "Payouts are not published yet.",
    });
  }
  if (campaign.on_chain_challenge_id == null) {
    return NextResponse.json({
      eligible: false,
      reason: "Campaign has no on-chain id.",
    });
  }

  const { data: leaves } = await admin
    .from("campaign_payout_claims")
    .select("wallet_address, amount_wei, rank, points_total, claimed_at, claim_tx_hash")
    .eq("campaign_id", id)
    .order("rank", { ascending: true });

  const winners = (leaves ?? []) as PayoutWinnerRow[];
  const myRow = (leaves ?? []).find(
    (r) => r.wallet_address.toLowerCase() === wallet.toLowerCase(),
  );

  if (!myRow) {
    return NextResponse.json({
      eligible: false,
      reason: "You are not in the prize zone for this campaign.",
    });
  }

  if (myRow.claimed_at) {
    return NextResponse.json({
      eligible: false,
      alreadyClaimed: true,
      amountWei: myRow.amount_wei,
      claimTxHash: myRow.claim_tx_hash,
      reason: "Already claimed.",
    });
  }

  const proofData = getProofForWinner({
    campaignIdOnChain: campaign.on_chain_challenge_id,
    winners,
    wallet,
  });

  if (!proofData) {
    return NextResponse.json({
      eligible: false,
      reason: "Could not build claim proof.",
    });
  }

  return NextResponse.json({
    eligible: true,
    alreadyClaimed: false,
    onChainChallengeId: campaign.on_chain_challenge_id,
    merkleRoot: campaign.payout_merkle_root as Hex,
    amountWei: proofData.amountWei.toString(),
    proof: proofData.proof,
    rank: proofData.rank,
    poolAmount: Number(campaign.proposed_pool_amount ?? 0),
    prizeWinnerCount: Number(campaign.prize_winner_count ?? 10),
  });
}

/**
 * POST — mark claim confirmed after on-chain tx.
 * Body: { address, txHash }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const addressRaw = String(body.address ?? "").trim();
  const txHash = String(body.txHash ?? "").trim();
  if (!addressRaw.startsWith("0x") || !txHash.startsWith("0x")) {
    return NextResponse.json({ error: "address and txHash are required" }, { status: 400 });
  }

  let wallet: Address;
  try {
    wallet = getAddress(addressRaw as Address);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("campaign_payout_claims")
    .update({ claimed_at: now, claim_tx_hash: txHash })
    .eq("campaign_id", id)
    .eq("wallet_address", wallet.toLowerCase())
    .is("claimed_at", null)
    .select("wallet_address, amount_wei, claimed_at, claim_tx_hash")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "Claim row not found or already claimed." },
      { status: 404 },
    );
  }

  return NextResponse.json({ claim: data });
}
