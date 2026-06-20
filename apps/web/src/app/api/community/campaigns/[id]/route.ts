import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import {
  fetchCommunityCampaignParticipantCountFromGraph,
  isJoinedCommunityCampaignOnGraph,
} from "@/lib/community/campaign-subgraph";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase() ?? null;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign, error } = await admin
    .from("community_campaigns")
    .select(`
      id, community_id, title, description, proof_cadence, proof_instructions,
      proposed_pool_amount, status, display_ends_at, duration_days,
      prize_winner_count, cover_image_url, created_at, updated_at,
      on_chain_challenge_id,
      communities ( id, name, slug, description, created_by )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const communityRaw = unwrapRelation(campaign.communities);

  let ownerName: string | null = null;
  if (communityRaw?.created_by) {
    const { data: owner } = await admin
      .from("staff_users")
      .select("display_name, email")
      .eq("id", communityRaw.created_by)
      .maybeSingle();
    ownerName =
      owner?.display_name ?? (owner?.email ? owner.email.split("@")[0] : null);
  }

  let isJoined = false;
  let isCommunityMember = false;
  let participantCount = 0;
  let myPoints = 0;

  if (campaign.on_chain_challenge_id) {
    participantCount = await fetchCommunityCampaignParticipantCountFromGraph(
      campaign.on_chain_challenge_id,
    );
    if (address) {
      const joined = await isJoinedCommunityCampaignOnGraph(
        campaign.on_chain_challenge_id,
        address,
      );
      isJoined = joined.joined;
      myPoints = joined.pointsTotal;
    }
  } else {
    const { count } = await admin
      .from("campaign_participants")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "joined");
    participantCount = count ?? 0;
  }

  if (address) {
    const { data: membership } = await admin
      .from("community_members")
      .select("id")
      .eq("community_id", campaign.community_id)
      .eq("wallet_address", address)
      .eq("status", "active")
      .maybeSingle();
    isCommunityMember = Boolean(membership);

    if (!campaign.on_chain_challenge_id) {
      const { data: participant } = await admin
        .from("campaign_participants")
        .select("id, points_total")
        .eq("campaign_id", id)
        .eq("wallet_address", address)
        .eq("status", "joined")
        .maybeSingle();
      isJoined = Boolean(participant);
      myPoints = participant?.points_total ?? 0;
    }
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      community_id: campaign.community_id,
      title: campaign.title,
      description: campaign.description,
      proof_cadence: campaign.proof_cadence,
      proof_instructions: campaign.proof_instructions,
      proposed_pool_amount: campaign.proposed_pool_amount,
      status: campaign.status,
      display_ends_at: campaign.display_ends_at,
      duration_days: campaign.duration_days,
      prize_winner_count: campaign.prize_winner_count,
      cover_image_url: campaign.cover_image_url ?? null,
      on_chain_challenge_id: campaign.on_chain_challenge_id,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
      communities: communityRaw
        ? {
            id: communityRaw.id,
            name: communityRaw.name,
            slug: communityRaw.slug,
            description: communityRaw.description,
            owner_name: ownerName,
          }
        : null,
    },
    isJoined,
    isCommunityMember,
    participantCount,
    myPoints,
  });
}
