import { NextRequest, NextResponse } from "next/server";
import {
  type CommunityCampaignFeedItem,
  decodeFeedCursor,
  encodeFeedCursor,
  isCampaignEndedByDate,
  isCampaignFunded,
  parseHomeCampaignFeedSection,
} from "@/lib/community/campaign-types";
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
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export const dynamic = "force-dynamic"; // address-specific, cannot be CDN-cached

const DEFAULT_LIMIT = 4;
const ONGOING_HOME_LIMIT = 5;
const MAX_LIMIT = 20;
const FETCH_BATCH = 40;

const CAMPAIGN_FEED_SELECT = `
  id, title, status, proposed_pool_amount, proof_cadence, duration_days,
  prize_winner_count, cover_image_url, display_ends_at, created_at, community_id,
  on_chain_challenge_id, is_free_to_join, join_token, join_amount, forfeit_pct,
  proof_instructions, telegram_link,
  communities ( id, name, slug )
`;

type CampaignRow = {
  id: string;
  title: string;
  status: string;
  proposed_pool_amount: number;
  proof_cadence: string;
  duration_days: number;
  prize_winner_count: number;
  cover_image_url: string | null;
  display_ends_at: string | null;
  created_at: string;
  community_id: string;
  on_chain_challenge_id: number | null;
  is_free_to_join?: boolean | null;
  join_token?: string | null;
  join_amount?: number | null;
  forfeit_pct?: number | null;
  proof_instructions?: string | null;
  telegram_link?: string | null;
  communities: { id: string; name: string; slug: string } | null;
};

function toFeedItem(
  row: CampaignRow,
  joined: boolean,
  participantData?: { streak: number; points: number },
  milestoneCount = 0,
  canJoin = false,
  participantCount = 0,
): CommunityCampaignFeedItem {
  const community = row.communities ?? { id: row.community_id, name: "Community", slug: "" };
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    is_funded: isCampaignFunded(row.status),
    proposed_pool_amount: Number(row.proposed_pool_amount),
    proof_cadence: row.proof_cadence,
    duration_days: Number(row.duration_days ?? 30),
    prize_winner_count: Number(row.prize_winner_count ?? 10),
    cover_image_url: row.cover_image_url ?? null,
    display_ends_at: row.display_ends_at,
    on_chain_challenge_id: row.on_chain_challenge_id,
    community: { id: community.id, name: community.name, slug: community.slug },
    participant_state: joined ? "joined" : "none",
    milestone_count: milestoneCount,
    can_join: canJoin,
    is_free_to_join: row.is_free_to_join !== false,
    join_token: row.join_token ?? "G$",
    join_amount: Number(row.join_amount ?? 0),
    forfeit_pct: Number(row.forfeit_pct ?? 0),
    proof_instructions: row.proof_instructions ?? null,
    telegram_link: row.telegram_link ?? null,
    participant_count: participantCount,
    ...(joined && participantData
      ? { myStreak: participantData.streak, myPoints: participantData.points }
      : {}),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const section = parseHomeCampaignFeedSection(searchParams.get("section"));
  const defaultLimit = section === "ongoing" ? ONGOING_HOME_LIMIT : DEFAULT_LIMIT;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? defaultLimit) || defaultLimit),
  );
  const cursor = searchParams.get("cursor");

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const decoded = cursor ? decodeFeedCursor(cursor) : null;

  let campaignsQuery = admin
    .from("community_campaigns")
    .select(CAMPAIGN_FEED_SELECT)
    .in("status", ["approved", "active"])
    .order("created_at", { ascending: false })
    .limit(FETCH_BATCH);

  if (decoded) {
    campaignsQuery = campaignsQuery.lt("created_at", decoded.createdAt);
  }

  const [{ data: joinedParticipants }, { data: rows, error }] = await Promise.all([
    admin
      .from("campaign_participants")
      .select("campaign_id, current_streak, points_total")
      .eq("wallet_address", address)
      .eq("status", "joined"),
    campaignsQuery,
  ]);

  const joinedCampaignIds = new Set((joinedParticipants ?? []).map((p) => p.campaign_id));
  const participantDataMap = new Map(
    (joinedParticipants ?? []).map((p) => [
      p.campaign_id,
      { streak: p.current_streak ?? 0, points: p.points_total ?? 0 },
    ]),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const onChainIds = (rows ?? [])
    .map((r) => (r as { on_chain_challenge_id?: number | null }).on_chain_challenge_id)
    .filter(isValidOnChainChallengeId);

  const graphJoinedIds = await fetchJoinedChallengeIdsFromGraph(address, onChainIds, true);
  const challengeIdToCampaignId = new Map<number, string>();
  for (const raw of rows ?? []) {
    const cid = (raw as { on_chain_challenge_id?: number | null; id: string }).on_chain_challenge_id;
    if (isValidOnChainChallengeId(cid)) challengeIdToCampaignId.set(cid, (raw as { id: string }).id);
  }
  for (const challengeId of graphJoinedIds) {
    const campaignId = challengeIdToCampaignId.get(challengeId);
    if (campaignId) joinedCampaignIds.add(campaignId);
  }

  const filtered: CampaignRow[] = [];
  for (const raw of rows ?? []) {
    const base = raw as unknown as CampaignRow;
    const row: CampaignRow = {
      ...base,
      communities: unwrapRelation(
        (raw as { communities: CampaignRow["communities"] | CampaignRow["communities"][] })
          .communities,
      ),
    };
    if (isCampaignEndedByDate(row.display_ends_at)) continue;

    const isJoined = joinedCampaignIds.has(row.id);
    if (section === "joined") {
      if (!isJoined) continue;
    } else if (isJoined) {
      continue; // Discover section shows only campaigns the user has not joined
    }

    filtered.push(row);
  }

  // Discover: prefer joinable campaigns (milestones configured).
  let page: CampaignRow[] = [];
  if (section === "ongoing") {
    const onChainFiltered = filtered
      .map((row) => row.on_chain_challenge_id)
      .filter(isValidOnChainChallengeId);
    const batchStats =
      onChainFiltered.length > 0
        ? await fetchBatchCampaignStats(onChainFiltered)
        : new Map();

    const joinable = filtered.filter((row) => {
      if (!isValidOnChainChallengeId(row.on_chain_challenge_id)) return false;
      const graphCount = batchStats.get(row.on_chain_challenge_id)?.milestoneCount ?? 0;
      return graphCount > 0;
    });
    page = joinable.slice(0, limit);
  } else {
    page = filtered.slice(0, limit);
  }

  const dbMilestoneCountMap = await fetchDbMilestoneCounts(
    admin,
    page.map((row) => row.id),
  );
  const pageOnChainIds = page
    .map((row) => row.on_chain_challenge_id)
    .filter(isValidOnChainChallengeId);
  const pageBatchStats =
    pageOnChainIds.length > 0
      ? await fetchBatchCampaignStats(pageOnChainIds)
      : new Map();

  const milestoneCounts = page.map((row) => {
    const dbCount = dbMilestoneCountMap.get(row.id) ?? 0;
    const graphCount = isValidOnChainChallengeId(row.on_chain_challenge_id)
      ? (pageBatchStats.get(row.on_chain_challenge_id)?.milestoneCount ?? 0)
      : 0;
    return mergeMilestoneCount(dbCount, graphCount);
  });

  const graphMilestoneCounts = page.map((row) =>
    isValidOnChainChallengeId(row.on_chain_challenge_id)
      ? (pageBatchStats.get(row.on_chain_challenge_id)?.milestoneCount ?? 0)
      : 0,
  );

  const pageCountMap = new Map<string, number>();
  for (const [challengeId, stats] of pageBatchStats) {
    const campaignId = page.find((r) => r.on_chain_challenge_id === challengeId)?.id;
    if (campaignId) pageCountMap.set(campaignId, stats.participantCount);
  }

  const campaigns = page.map((row, i) => {
    const isJoined = joinedCampaignIds.has(row.id);
    const graphCount = graphMilestoneCounts[i] ?? 0;
    const count = isValidOnChainChallengeId(row.on_chain_challenge_id)
      ? graphCount
      : (milestoneCounts[i] ?? 0);
    const canJoin = isJoined
      ? false
      : isValidOnChainChallengeId(row.on_chain_challenge_id) && graphCount > 0;
    return toFeedItem(
      row,
      isJoined,
      isJoined ? participantDataMap.get(row.id) : undefined,
      count,
      canJoin,
      pageCountMap.get(row.id) ?? 0,
    );
  });

  const last = page[page.length - 1];
  const hasMoreInBatch = filtered.length > limit;
  const batchFull = (rows ?? []).length >= FETCH_BATCH;
  const nextCursor =
    section === "ongoing"
      ? null
      : last && (hasMoreInBatch || batchFull)
        ? encodeFeedCursor(last.created_at, last.id)
        : null;

  return NextResponse.json({ campaigns, nextCursor });
}
