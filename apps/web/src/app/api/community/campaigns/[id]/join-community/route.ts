import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { upsertCommunityMember } from "@/lib/community/join-member";
import {
  requireAuthenticatedWallet,
  walletAuthErrorResponse,
} from "@/lib/auth/wallet-session";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  try {
    requireAuthenticatedWallet(request, walletAddress);
  } catch (err) {
    return walletAuthErrorResponse(err);
  }

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("community_id, communities ( id, name, status )")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const community = Array.isArray(campaign.communities)
    ? campaign.communities[0]
    : campaign.communities;

  if (!community || community.status !== "active") {
    return NextResponse.json({ error: "Community is not active" }, { status: 403 });
  }

  try {
    await upsertCommunityMember(admin, {
      communityId: campaign.community_id,
      walletAddress,
      joinedVia: "onboarding",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join community" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, communityName: community.name });
}
