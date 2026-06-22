import { NextRequest, NextResponse } from "next/server";
import {
  fetchCommunityCampaignMilestoneCountFromGraph,
  fetchCommunityCampaignParticipantCountFromGraph,
  fetchJoinedChallengeIdsFromGraph,
} from "@/lib/community/campaign-subgraph";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase() ?? null;
  const cursor = searchParams.get("cursor") ?? null;
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  let query = admin
    .from("community_campaigns")
    .select(`
      id, title, description, proof_cadence, proposed_pool_amount,
      duration_days, prize_winner_count, cover_image_url, display_ends_at,
      on_chain_challenge_id, status, created_at,
      communities ( id, name, slug )
    `)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasMore = (rows?.length ?? 0) > limit;
  const campaigns = (rows ?? []).slice(0, limit);
  const nextCursor = hasMore ? campaigns[campaigns.length - 1]?.created_at ?? null : null;

  const campaignIds = campaigns.map((c) => c.id);
  const onChainIds = campaigns
    .map((c) => c.on_chain_challenge_id)
    .filter((id): id is number => id != null);

  const countMap = new Map<string, number>();
  const joinedSet = new Set<string>();

  if (address && campaignIds.length > 0) {
    const { data: joinedRows } = await admin
      .from("campaign_participants")
      .select("campaign_id")
      .in("campaign_id", campaignIds)
      .eq("wallet_address", address)
      .eq("status", "joined");
    for (const row of joinedRows ?? []) {
      joinedSet.add(row.campaign_id);
    }
  }

  if (onChainIds.length > 0) {
    const challengeIdToCampaignId = new Map<number, string>();
    for (const c of campaigns) {
      if (c.on_chain_challenge_id != null) {
        challengeIdToCampaignId.set(c.on_chain_challenge_id, c.id);
      }
    }

    if (address) {
      const graphJoinedIds = await fetchJoinedChallengeIdsFromGraph(address, onChainIds);
      for (const challengeId of graphJoinedIds) {
        const campaignId = challengeIdToCampaignId.get(challengeId);
        if (campaignId) joinedSet.add(campaignId);
      }
    }

    await Promise.all(
      onChainIds.map(async (challengeId) => {
        const campaignId = challengeIdToCampaignId.get(challengeId);
        if (!campaignId) return;
        const count = await fetchCommunityCampaignParticipantCountFromGraph(challengeId);
        countMap.set(campaignId, count);
      }),
    );
  }

  const legacyIds = campaignIds.filter((id) => !countMap.has(id));
  if (legacyIds.length > 0) {
    const { data: countRows } = await admin
      .from("campaign_participants")
      .select("campaign_id")
      .in("campaign_id", legacyIds)
      .eq("status", "joined");

    for (const row of countRows ?? []) {
      countMap.set(row.campaign_id, (countMap.get(row.campaign_id) ?? 0) + 1);
    }
  }

  const milestoneCounts = await Promise.all(
    campaigns.map(async (c) => {
      if (!c.on_chain_challenge_id) return 0;
      return fetchCommunityCampaignMilestoneCountFromGraph(c.on_chain_challenge_id);
    }),
  );

  const result = campaigns.map((c, index) => {
    const community = Array.isArray(c.communities) ? c.communities[0] : c.communities;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      proofCadence: c.proof_cadence,
      proposedPoolAmount: c.proposed_pool_amount,
      durationDays: c.duration_days,
      prizeWinnerCount: c.prize_winner_count,
      coverImageUrl: c.cover_image_url,
      displayEndsAt: c.display_ends_at,
      isOnChain: Boolean(c.on_chain_challenge_id),
      status: c.status,
      participantCount: countMap.get(c.id) ?? 0,
      milestoneCount: milestoneCounts[index] ?? 0,
      isJoined: joinedSet.has(c.id),
      community: community
        ? { id: community.id, name: community.name, slug: community.slug }
        : null,
    };
  });

  return NextResponse.json(
    { campaigns: result, nextCursor },
    { headers: { "Cache-Control": "no-store" } },
  );
}
