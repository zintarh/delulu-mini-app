import { NextRequest, NextResponse } from "next/server";
import {
  isCampaignEndedByDate,
  isCampaignParticipatable,
} from "@/lib/community/campaign-types";
import { fetchCommunityCampaignMilestoneCountFromGraph } from "@/lib/community/campaign-subgraph";
import { fetchCampaignOnchainEconomics } from "@/lib/community/campaign-onchain-economics";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
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
      is_free_to_join, join_amount, join_token,
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

  if (isValidOnChainChallengeId(campaign.on_chain_challenge_id)) {
    const challengeId = campaign.on_chain_challenge_id;
    const [graphCount, dbCounts] = await Promise.all([
      fetchCommunityCampaignMilestoneCountFromGraph(challengeId),
      fetchDbMilestoneCounts(admin, [campaignId]),
    ]);
    const milestoneCount = mergeMilestoneCount(
      dbCounts.get(campaignId) ?? 0,
      graphCount,
    );
    if (graphCount === 0) {
      return NextResponse.json(
        {
          error:
            milestoneCount > 0
              ? "Milestones are being finalized on-chain. Try again shortly."
              : "Owner is setting up milestones on-chain",
          milestoneCount,
        },
        { status: 403 },
      );
    }

    const onchain = await fetchCampaignOnchainEconomics(challengeId);

    return NextResponse.json({
      ok: true,
      requiresOnChain: true,
      challengeId,
      joinedCommunity,
      milestoneCount,
      isPaidOnChain: onchain?.isPaid ?? false,
      joinAmountOnChain: onchain?.joinAmount ?? 0,
      joinTokenOnChain: onchain?.joinTokenLabel ?? campaign.join_token ?? "G$",
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  }

  // Approved/active campaigns must be registered on-chain before joining.
  return NextResponse.json(
    {
      error:
        "This campaign is not live on-chain yet. The community owner must complete on-chain registration before members can join.",
    },
    { status: 403 },
  );
}
