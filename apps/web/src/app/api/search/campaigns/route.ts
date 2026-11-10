import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchBatchCampaignStats } from "@/lib/community/campaign-subgraph";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
import {
  fetchCampaignParticipantAvatars,
  type ParticipantAvatar,
} from "@/lib/community/campaign-participant-avatars";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;

export type CampaignSearchResult = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  display_ends_at: string | null;
  duration_days: number;
  is_free_to_join: boolean;
  join_amount: number;
  join_token: string | null;
  community_name: string;
  community_slug: string;
  /** Same stats the Home/Explore campaign cards show. */
  status: string;
  proposed_pool_amount: number;
  proof_cadence: string;
  forfeit_pct: number;
  created_at: string;
  participant_count: number;
  participant_avatars: ParticipantAvatar[];
  milestone_count: number;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ results: [] });

  const pattern = `%${q}%`;

  const { data, error } = await admin
    .from("community_campaigns")
    .select(
      "id, title, description, cover_image_url, display_ends_at, duration_days, is_free_to_join, join_amount, join_token, status, proposed_pool_amount, proof_cadence, forfeit_pct, created_at, on_chain_challenge_id, communities ( name, slug )",
    )
    .neq("status", "draft")
    .eq("is_hidden", false)
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS);

  if (error) return NextResponse.json({ results: [] });

  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const onChainIds = rows
    .map((row) => row.on_chain_challenge_id as number | null)
    .filter(isValidOnChainChallengeId);
  const [dbMilestoneCounts, chainStats, avatarsByCampaign] = await Promise.all([
    fetchDbMilestoneCounts(admin, ids),
    fetchBatchCampaignStats(onChainIds),
    fetchCampaignParticipantAvatars(admin, ids),
  ]);

  const results: CampaignSearchResult[] = rows.map((row) => {
    const id = String(row.id);
    const challengeId = row.on_chain_challenge_id as number | null;
    const stats = isValidOnChainChallengeId(challengeId) ? chainStats.get(challengeId) : undefined;
    const community = (Array.isArray(row.communities) ? row.communities[0] : row.communities) as { name: string; slug: string } | null;
    return {
      id,
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      cover_image_url: (row.cover_image_url as string | null) ?? null,
      display_ends_at: (row.display_ends_at as string | null) ?? null,
      duration_days: Number(row.duration_days ?? 30),
      is_free_to_join: row.is_free_to_join !== false,
      join_amount: Number(row.join_amount ?? 0),
      join_token: (row.join_token as string | null) ?? null,
      community_name: community?.name ?? "",
      community_slug: community?.slug ?? "",
      status: String(row.status ?? "active"),
      proposed_pool_amount: Number(row.proposed_pool_amount ?? 0),
      proof_cadence: String(row.proof_cadence ?? "daily"),
      forfeit_pct: Number(row.forfeit_pct ?? 0),
      created_at: String(row.created_at),
      participant_count: stats?.participantCount ?? 0,
      participant_avatars: avatarsByCampaign.get(id) ?? [],
      milestone_count: mergeMilestoneCount(dbMilestoneCounts.get(id) ?? 0, stats?.milestoneCount ?? 0),
    };
  });

  return NextResponse.json({ results });
}
