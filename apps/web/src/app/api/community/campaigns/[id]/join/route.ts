import { NextRequest, NextResponse } from "next/server";
import {
  isCampaignEndedByDate,
  isCampaignParticipatable,
} from "@/lib/community/campaign-types";
import { fetchCommunityCampaignMilestoneCountFromGraph } from "@/lib/community/campaign-subgraph";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

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
    .select(`
      id, community_id, status, title, display_ends_at, on_chain_challenge_id,
      communities ( id, name, slug, status )
    `)
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!isCampaignParticipatable(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not open for participation" }, { status: 400 });
  }
  if (isCampaignEndedByDate(campaign.display_ends_at)) {
    return NextResponse.json({ error: "Campaign has ended" }, { status: 400 });
  }

  const community = unwrapRelation(campaign.communities);

  if (!community || community.status !== "active") {
    return NextResponse.json({ error: "Community is not active" }, { status: 403 });
  }

  const { data: membership } = await admin
    .from("community_members")
    .select("id, status")
    .eq("community_id", campaign.community_id)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  const joinedCommunity = Boolean(membership?.status === "active");

  if (campaign.on_chain_challenge_id) {
    const milestoneCount = await fetchCommunityCampaignMilestoneCountFromGraph(
      campaign.on_chain_challenge_id,
    );
    if (milestoneCount === 0) {
      return NextResponse.json(
        { error: "Owner is setting up milestones", milestoneCount: 0 },
        { status: 403 },
      );
    }
    return NextResponse.json({
      ok: true,
      requiresOnChain: true,
      challengeId: campaign.on_chain_challenge_id,
      joinedCommunity,
      milestoneCount,
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  }

  const { data: existing } = await admin
    .from("campaign_participants")
    .select("id, status")
    .eq("campaign_id", campaignId)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing?.status === "joined") {
    return NextResponse.json({
      ok: true,
      participantId: existing.id,
      alreadyJoined: true,
      joinedCommunity,
      joinedCampaign: false,
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  }

  const payload: Record<string, unknown> = {
    campaign_id: campaignId,
    wallet_address: walletAddress,
    status: "joined",
  };
  if (existing?.status === "withdrawn") {
    payload.points_total = 0;
    payload.current_streak = 0;
  }

  const { data: participant, error } = await admin
    .from("campaign_participants")
    .upsert(payload, { onConflict: "campaign_id,wallet_address" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    participantId: participant.id,
    alreadyJoined: false,
    joinedCommunity,
    joinedCampaign: true,
    community: { id: community.id, name: community.name, slug: community.slug },
  });
}
