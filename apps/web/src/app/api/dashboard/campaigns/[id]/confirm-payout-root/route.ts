import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Confirm that setCommunityPayoutRoot was published on-chain.
 * Body: { txHash, merkleRoot }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim();
  const merkleRoot = String(body.merkleRoot ?? "").trim().toLowerCase();
  if (!txHash.startsWith("0x") || !merkleRoot.startsWith("0x")) {
    return NextResponse.json({ error: "txHash and merkleRoot are required" }, { status: 400 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, community_id, status, payout_merkle_root")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin && !session.communityIds.includes(campaign.community_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (campaign.status !== "ended") {
    return NextResponse.json({ error: "Campaign must be ended first." }, { status: 400 });
  }
  if (!campaign.payout_merkle_root) {
    return NextResponse.json({ error: "No payout snapshot on this campaign." }, { status: 400 });
  }
  if (campaign.payout_merkle_root.toLowerCase() !== merkleRoot) {
    return NextResponse.json({ error: "merkleRoot does not match snapshot." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("community_campaigns")
    .update({ payout_published_at: now, updated_at: now })
    .eq("id", id)
    .select("id, payout_merkle_root, payout_published_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "payout_published", session.userId, {
    tx_hash: txHash,
    merkle_root: merkleRoot,
  });

  return NextResponse.json({ campaign: data });
}
