import { NextRequest, NextResponse } from "next/server";
import {
  type CommunityCampaignFeedItem,
  decodeFeedCursor,
  encodeFeedCursor,
  isCampaignEndedByDate,
  isCampaignFunded,
  parseHomeCampaignFeedSection,
  PARTICIPATING_STATUSES,
} from "@/lib/community/campaign-types";
import {
  fetchCommunityCampaignMilestoneCountFromGraph,
  fetchJoinedChallengeIdsFromGraph,
} from "@/lib/community/campaign-subgraph";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export const dynamic = "force-dynamic"; // address-specific, cannot be CDN-cached

const DEFAULT_LIMIT = 4;
const ONGOING_HOME_LIMIT = 3;
const MAX_LIMIT = 20;
const FETCH_BATCH = 40;

const CAMPAIGN_FEED_SELECT = `
  id, title, status, proposed_pool_amount, proof_cadence, duration_days,
  prize_winner_count, cover_image_url, display_ends_at, created_at, community_id,
  on_chain_challenge_id,
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
  communities: { id: string; name: string; slug: string } | null;
};

function toFeedItem(
  row: CampaignRow,
  joined: boolean,
  participantData?: { streak: number; points: number },
  milestoneCount = 0,
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
    .in("status", [...PARTICIPATING_STATUSES])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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
    .filter((id): id is number => id != null);

  const graphJoinedIds = await fetchJoinedChallengeIdsFromGraph(address, onChainIds);
  const challengeIdToCampaignId = new Map<number, string>();
  for (const raw of rows ?? []) {
    const cid = (raw as { on_chain_challenge_id?: number | null; id: string }).on_chain_challenge_id;
    if (cid != null) challengeIdToCampaignId.set(cid, (raw as { id: string }).id);
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
    }
    // For "ongoing" (discover), include all campaigns — joined ones show "Joined · View →"

    filtered.push(row);
  }

  const page = filtered.slice(0, limit);

  // For non-on-chain campaigns fetch milestone counts from Supabase (not the subgraph).
  const offChainPageIds = page
    .filter((row) => !row.on_chain_challenge_id)
    .map((row) => row.id);

  const dbMilestoneCountMap = new Map<string, number>();
  if (offChainPageIds.length > 0) {
    const { data: dbMilestones } = await admin
      .from("campaign_milestones")
      .select("campaign_id")
      .in("campaign_id", offChainPageIds);
    for (const m of dbMilestones ?? []) {
      const cid = (m as { campaign_id: string }).campaign_id;
      dbMilestoneCountMap.set(cid, (dbMilestoneCountMap.get(cid) ?? 0) + 1);
    }
  }

  const milestoneCounts = await Promise.all(
    page.map((row) =>
      row.on_chain_challenge_id
        ? fetchCommunityCampaignMilestoneCountFromGraph(row.on_chain_challenge_id)
        : Promise.resolve(dbMilestoneCountMap.get(row.id) ?? 0),
    ),
  );
  const campaigns = page.map((row, i) => {
    const isJoined = joinedCampaignIds.has(row.id);
    return toFeedItem(
      row,
      isJoined,
      isJoined ? participantDataMap.get(row.id) : undefined,
      milestoneCounts[i],
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
