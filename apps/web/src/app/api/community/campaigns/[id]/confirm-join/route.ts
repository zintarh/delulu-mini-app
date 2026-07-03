import { NextRequest, NextResponse } from "next/server";
import { parseCommunityCampaignJoinedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/** Metadata mirror only — on-chain join is source of truth; this powers discover filtering. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
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

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, on_chain_challenge_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!isValidOnChainChallengeId(campaign.on_chain_challenge_id)) {
    return NextResponse.json({ error: "Campaign is not registered on-chain" }, { status: 400 });
  }

  // ── 2-campaign join limit (double-check at confirm time) ───────────────
  const { count: activeCount } = await admin
    .from("campaign_participants")
    .select(
      `id, community_campaigns!inner(status, display_ends_at)`,
      { count: "exact", head: true },
    )
    .eq("wallet_address", walletAddress)
    .eq("status", "joined")
    .in("community_campaigns.status", ["active", "approved", "open"])
    .neq("campaign_id", campaignId);

  if ((activeCount ?? 0) >= 2) {
    return NextResponse.json(
      { error: "You can only join 2 campaigns at a time. Complete your active campaigns to join another." },
      { status: 403 },
    );
  }
  // ──────────────────────────────────────────────────────────────────────

  let parsed;
  try {
    parsed = await parseCommunityCampaignJoinedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (
    !parsed ||
    Number(parsed.challengeId) !== campaign.on_chain_challenge_id ||
    parsed.participant !== walletAddress
  ) {
    return NextResponse.json(
      { error: "CommunityCampaignJoined event not found for this wallet and campaign." },
      { status: 400 },
    );
  }

  const { data: participant, error } = await admin
    .from("campaign_participants")
    .upsert(
      {
        campaign_id: campaignId,
        wallet_address: walletAddress,
        status: "joined",
      },
      { onConflict: "campaign_id,wallet_address" },
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, participantId: participant.id });
}
