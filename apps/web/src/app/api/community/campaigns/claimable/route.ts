import { NextRequest, NextResponse } from "next/server";
import { getAddress, type Address, type Hex } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  getProofForWinner,
  type PayoutWinnerRow,
} from "@/lib/community/build-payout-snapshot";

export const dynamic = "force-dynamic";

export type ClaimableCampaignItem = {
  campaignId: string;
  title: string;
  communitySlug: string | null;
  communityName: string | null;
  onChainChallengeId: number;
  amountWei: string;
  rank: number;
  proof: Hex[];
  merkleRoot: Hex;
};

/**
 * GET /api/community/campaigns/claimable?address=0x…
 * Lists ended campaigns the wallet can still claim from.
 */
export async function GET(request: NextRequest) {
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

  const walletLower = wallet.toLowerCase();

  const { data: myLeaves, error: leavesError } = await admin
    .from("campaign_payout_claims")
    .select("campaign_id, amount_wei, rank, points_total, claimed_at")
    .eq("wallet_address", walletLower)
    .is("claimed_at", null);

  if (leavesError) {
    // Table may not exist yet before migration — return empty rather than 500.
    if (leavesError.code === "42P01" || /does not exist/i.test(leavesError.message)) {
      return NextResponse.json({ items: [] as ClaimableCampaignItem[] });
    }
    return NextResponse.json({ error: leavesError.message }, { status: 500 });
  }

  if (!myLeaves?.length) {
    return NextResponse.json({ items: [] as ClaimableCampaignItem[] });
  }

  const campaignIds = [...new Set(myLeaves.map((l) => l.campaign_id))];

  const { data: campaigns, error: campaignsError } = await admin
    .from("community_campaigns")
    .select(
      "id, title, status, on_chain_challenge_id, payout_merkle_root, payout_published_at, communities(name, slug)",
    )
    .in("id", campaignIds)
    .eq("status", "ended")
    .not("payout_published_at", "is", null)
    .not("payout_merkle_root", "is", null);

  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));

  // One query for all winners across claimable campaigns (needed to rebuild merkle proofs).
  const claimableCampaignIds = [...campaignById.keys()];
  let allLeavesForCampaigns: Array<{
    campaign_id: string;
    wallet_address: string;
    amount_wei: string;
    rank: number;
    points_total: number;
  }> = [];

  if (claimableCampaignIds.length > 0) {
    const { data } = await admin
      .from("campaign_payout_claims")
      .select("campaign_id, wallet_address, amount_wei, rank, points_total")
      .in("campaign_id", claimableCampaignIds)
      .order("rank", { ascending: true });
    allLeavesForCampaigns = (data ?? []) as typeof allLeavesForCampaigns;
  }

  const leavesByCampaign = new Map<string, PayoutWinnerRow[]>();
  for (const row of allLeavesForCampaigns) {
    const list = leavesByCampaign.get(row.campaign_id) ?? [];
    list.push({
      wallet_address: row.wallet_address,
      amount_wei: row.amount_wei,
      rank: row.rank,
      points_total: row.points_total,
    });
    leavesByCampaign.set(row.campaign_id, list);
  }

  const items: ClaimableCampaignItem[] = [];

  for (const leaf of myLeaves) {
    const campaign = campaignById.get(leaf.campaign_id);
    if (!campaign || campaign.on_chain_challenge_id == null || !campaign.payout_merkle_root) {
      continue;
    }

    const winners = leavesByCampaign.get(leaf.campaign_id) ?? [];
    const proofData = getProofForWinner({
      campaignIdOnChain: campaign.on_chain_challenge_id,
      winners,
      wallet,
    });
    if (!proofData) continue;

    const community = Array.isArray(campaign.communities)
      ? campaign.communities[0]
      : campaign.communities;

    items.push({
      campaignId: campaign.id,
      title: campaign.title ?? "Campaign",
      communitySlug: community?.slug ?? null,
      communityName: community?.name ?? null,
      onChainChallengeId: campaign.on_chain_challenge_id,
      amountWei: proofData.amountWei.toString(),
      rank: proofData.rank,
      proof: proofData.proof,
      merkleRoot: campaign.payout_merkle_root as Hex,
    });
  }

  // Highest amount first
  items.sort((a, b) => {
    const diff = BigInt(b.amountWei) - BigInt(a.amountWei);
    if (diff > 0n) return 1;
    if (diff < 0n) return -1;
    return a.rank - b.rank;
  });

  return NextResponse.json({ items });
}
