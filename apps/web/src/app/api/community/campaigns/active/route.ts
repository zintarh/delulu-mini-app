import { NextRequest, NextResponse } from "next/server";
import { isCampaignEndedByDate } from "@/lib/community/campaign-types";
import {
  fetchBatchCampaignStats,
  fetchJoinedChallengeIdsFromGraph,
} from "@/lib/community/campaign-subgraph";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
import { fetchCampaignParticipantAvatars } from "@/lib/community/campaign-participant-avatars";
import { isPaidJoinCampaign } from "@/lib/community/campaign-join-info";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// "participants" sort re-ranks the most recent MAX_CANDIDATES campaigns by
// join count — it can't be combined with cursor pagination since participant
// counts aren't stored on the row and are only known after fetching.
const MAX_CANDIDATES = 50;

// Campaigns this close to ending sink to the bottom of the ranked list —
// promoting a nearly-over campaign discourages new joins.
const ENDING_SOON_DAYS = 3;

function daysLeft(displayEndsAt: string | null): number {
  if (!displayEndsAt) return Infinity;
  return Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase() ?? null;
  const cursor = searchParams.get("cursor") ?? null;
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const requestedSort = searchParams.get("sort") === "recent" ? "recent" : "participants";
  const durationDaysParam = Number(searchParams.get("durationDays"));
  const durationFilter = [7, 14, 30, 60].includes(durationDaysParam) ? durationDaysParam : null;
  const endedFilter = searchParams.get("status") === "ended";
  // "Ending soon" (still active, close to its deadline) and "ended" (already
  // over) are mutually exclusive views — ended wins if both are somehow set.
  const endingSoonFilter = !endedFilter && searchParams.get("endingSoon") === "true";
  // Ended campaigns have nothing left to rank by participant momentum or
  // ending-soon urgency — always browse them newest-ended-first.
  const sort = endedFilter ? "recent" : requestedSort;

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
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (durationFilter) query = query.eq("duration_days", durationFilter);
  if (endingSoonFilter) {
    const cutoff = new Date(Date.now() + ENDING_SOON_DAYS * 86400000).toISOString();
    query = query.lte("display_ends_at", cutoff);
  }

  if (sort === "recent" && cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activeRows = (rows ?? []).filter((row) =>
    endedFilter ? isCampaignEndedByDate(row.display_ends_at) : !isCampaignEndedByDate(row.display_ends_at),
  );

  const hasMore = sort === "recent" && activeRows.length > limit;
  const candidates = sort === "recent" ? activeRows.slice(0, limit) : activeRows;

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
      .sort((a, b) => {
        const aPaid = isPaidJoinCampaign(a);
        const bPaid = isPaidJoinCampaign(b);
        if (aPaid !== bPaid) return aPaid ? -1 : 1;

        // Explicitly browsing "ending soon" — soonest-to-end first is the
        // whole point, so skip the usual participant-count ranking.
        if (endingSoonFilter) return daysLeft(a.displayEndsAt) - daysLeft(b.displayEndsAt);

        const aEndingSoon = daysLeft(a.displayEndsAt) <= ENDING_SOON_DAYS;
        const bEndingSoon = daysLeft(b.displayEndsAt) <= ENDING_SOON_DAYS;
        if (aEndingSoon !== bEndingSoon) return aEndingSoon ? 1 : -1;
        return b.participantCount - a.participantCount || (b._createdAt > a._createdAt ? 1 : -1);
      })
      .slice(0, limit);
  } else {
    result = result
      .slice()
      .sort((a, b) => {
        const aPaid = isPaidJoinCampaign(a);
        const bPaid = isPaidJoinCampaign(b);
        if (aPaid !== bPaid) return aPaid ? -1 : 1;
        return b._createdAt > a._createdAt ? 1 : -1;
      });
    if (hasMore) {
      nextCursor = candidates[candidates.length - 1]?.created_at ?? null;
    }
  }

  const avatarsByCampaign = await fetchCampaignParticipantAvatars(
    admin,
    result.map((c) => c.id),
  );

  const campaigns = result.map(({ _createdAt, ...rest }) => ({
    ...rest,
    participantAvatars: avatarsByCampaign.get(rest.id) ?? [],
  }));

  const cacheControl = address
    ? "private, no-store"
    : "public, s-maxage=60, stale-while-revalidate=120";

  return NextResponse.json(
    { campaigns, nextCursor },
    { headers: { "Cache-Control": cacheControl } },
  );
}
