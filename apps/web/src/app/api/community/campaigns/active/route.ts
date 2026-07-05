import { NextRequest, NextResponse } from "next/server";
import {
  fetchBatchCampaignStats,
  fetchJoinedChallengeIdsFromGraph,
} from "@/lib/community/campaign-subgraph";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// "participants" sort re-ranks the most recent MAX_CANDIDATES campaigns by
// join count — it can't be combined with cursor pagination since participant
// counts aren't stored on the row and are only known after fetching.
const MAX_CANDIDATES = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase() ?? null;
  const cursor = searchParams.get("cursor") ?? null;
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const sort = searchParams.get("sort") === "recent" ? "recent" : "participants";

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const fetchLimit = sort === "participants" ? MAX_CANDIDATES : limit + 1;

  let query = admin
    .from("community_campaigns")
    .select(`
      id, title, description, proof_cadence, proposed_pool_amount,
      duration_days, prize_winner_count, cover_image_url, display_ends_at,
      on_chain_challenge_id, status, created_at,
      is_free_to_join, join_token, join_amount, forfeit_pct, proof_instructions, telegram_link,
      communities ( id, name, slug )
    `)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (sort === "recent" && cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasMore = sort === "recent" && (rows?.length ?? 0) > limit;
  const candidates = sort === "recent" ? (rows ?? []).slice(0, limit) : (rows ?? []);

  const candidateIds = candidates.map((c) => c.id);
  const onChainIds = candidates
    .map((c) => c.on_chain_challenge_id)
    .filter(isValidOnChainChallengeId);

  const countMap = new Map<string, number>();
  const joinedSet = new Set<string>();
  const leftSet = new Set<string>();

  if (address && candidateIds.length > 0) {
    const { data: participantRows } = await admin
      .from("campaign_participants")
      .select("campaign_id, status")
      .in("campaign_id", candidateIds)
      .eq("wallet_address", address)
      .in("status", ["joined", "left"]);
    for (const row of participantRows ?? []) {
      if (row.status === "left") leftSet.add(row.campaign_id);
      else joinedSet.add(row.campaign_id);
    }
  }

  const challengeIdToCampaignId = new Map<number, string>();
  for (const c of candidates) {
    if (isValidOnChainChallengeId(c.on_chain_challenge_id)) {
      challengeIdToCampaignId.set(c.on_chain_challenge_id, c.id);
    }
  }

  const legacyIds = candidateIds.filter(
    (id) => !candidates.find((c) => c.id === id && isValidOnChainChallengeId(c.on_chain_challenge_id)),
  );

  const [batchStats, legacyCountRows, graphJoinedIds, dbMilestoneCounts] = await Promise.all([
    onChainIds.length > 0 ? fetchBatchCampaignStats(onChainIds) : Promise.resolve(new Map()),
    legacyIds.length > 0
      ? admin
          .from("campaign_participants")
          .select("campaign_id")
          .in("campaign_id", legacyIds)
          .eq("status", "joined")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    address && onChainIds.length > 0
      ? fetchJoinedChallengeIdsFromGraph(address, onChainIds)
      : Promise.resolve(new Set<number>()),
    fetchDbMilestoneCounts(admin, candidateIds),
  ]);

  for (const [challengeId, stats] of batchStats) {
    const campaignId = challengeIdToCampaignId.get(challengeId);
    if (campaignId) countMap.set(campaignId, stats.participantCount);
  }

  for (const row of legacyCountRows) {
    countMap.set(row.campaign_id, (countMap.get(row.campaign_id) ?? 0) + 1);
  }

  if (address) {
    for (const challengeId of graphJoinedIds) {
      const campaignId = challengeIdToCampaignId.get(challengeId);
      // A user who explicitly left stays hidden even though the subgraph still
      // reflects their on-chain join — there's no on-chain "leave" transaction.
      if (campaignId && !leftSet.has(campaignId)) joinedSet.add(campaignId);
    }
  }

  const milestoneCounts = candidates.map((c) => {
    const dbCount = dbMilestoneCounts.get(c.id) ?? 0;
    if (!isValidOnChainChallengeId(c.on_chain_challenge_id)) return dbCount;
    const graphCount = batchStats.get(c.on_chain_challenge_id)?.milestoneCount ?? 0;
    return mergeMilestoneCount(dbCount, graphCount);
  });

  let result = candidates.map((c, index) => {
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
      isOnChain: isValidOnChainChallengeId(c.on_chain_challenge_id),
      status: c.status,
      participantCount: countMap.get(c.id) ?? 0,
      milestoneCount: milestoneCounts[index] ?? 0,
      canJoin: joinedSet.has(c.id)
        ? false
        : isValidOnChainChallengeId(c.on_chain_challenge_id) &&
          (milestoneCounts[index] ?? 0) > 0,
      isJoined: joinedSet.has(c.id),
      isFreeToJoin: c.is_free_to_join !== false,
      joinToken: c.join_token ?? "G$",
      joinAmount: Number(c.join_amount ?? 0),
      forfeitPct: Number(c.forfeit_pct ?? 0),
      proofInstructions: c.proof_instructions ?? null,
      telegramLink: (c as { telegram_link?: string | null }).telegram_link ?? null,
      community: community
        ? { id: community.id, name: community.name, slug: community.slug }
        : null,
      _createdAt: c.created_at,
    };
  });

  let nextCursor: string | null = null;
  if (sort === "participants") {
    result = result
      .slice()
      .sort((a, b) => b.participantCount - a.participantCount || (b._createdAt > a._createdAt ? 1 : -1))
      .slice(0, limit);
  } else if (hasMore) {
    nextCursor = candidates[candidates.length - 1]?.created_at ?? null;
  }

  const campaigns = result.map(({ _createdAt, ...rest }) => rest);

  const cacheControl = address
    ? "private, no-store"
    : "public, s-maxage=60, stale-while-revalidate=120";

  return NextResponse.json(
    { campaigns, nextCursor },
    { headers: { "Cache-Control": cacheControl } },
  );
}
