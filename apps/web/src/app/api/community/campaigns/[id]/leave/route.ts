import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { isPaidJoinCampaign } from "@/lib/community/campaign-join-info";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("is_free_to_join, join_amount")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Paid stake stays on-chain until end; leaving would hide proofs and force forfeit.
  if (isPaidJoinCampaign(campaign)) {
    return NextResponse.json(
      {
        error:
          "Paid campaigns can't be left. Your stake stays locked until the campaign ends — then reclaim from Rewards.",
      },
      { status: 400 },
    );
  }

  const { data: participant } = await admin
    .from("campaign_participants")
    .select("id, status")
    .eq("campaign_id", campaignId)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "You are not a participant in this campaign" }, { status: 404 });
  }

  if (participant.status === "left") {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await admin
    .from("campaign_participants")
    .update({ status: "left" })
    .eq("id", participant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
