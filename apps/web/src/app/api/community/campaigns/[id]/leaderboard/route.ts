import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  fetchCommunityCampaignLeaderboardFromGraph,
  fetchCommunityCampaignParticipantCountFromGraph,
  isJoinedCommunityCampaignOnGraph,
} from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";

export const dynamic = "force-dynamic";

async function supabaseLeaderboard(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  campaignId: string,
  communityId: string,
) {
  const { data, error } = await admin
    .from("campaign_participants")
    .select("wallet_address, points_total, current_streak, joined_at")
    .eq("campaign_id", campaignId)
    .eq("status", "joined")
    .order("points_total", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const wallets = (data ?? []).map((row) => row.wallet_address.toLowerCase());
  const memberWallets = new Set<string>();

  if (wallets.length > 0) {
    const { data: members } = await admin
      .from("community_members")
      .select("wallet_address")
      .eq("community_id", communityId)
      .eq("status", "active")
      .in("wallet_address", wallets);

    for (const m of members ?? []) {
      memberWallets.add(m.wallet_address.toLowerCase());
    }
  }

  return (data ?? []).map((row, index) => ({
    rank: index + 1,
    wallet_address: row.wallet_address,
    points_total: row.points_total,
    current_streak: row.current_streak,
    joined_at: row.joined_at,
    is_community_member: memberWallets.has(row.wallet_address.toLowerCase()),
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("community_id, on_chain_challenge_id")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  if (campaign.on_chain_challenge_id != null) {
    const { data: members } = await admin
      .from("community_members")
      .select("wallet_address")
      .eq("community_id", campaign.community_id)
      .eq("status", "active");

    const memberWallets = new Set(
      (members ?? []).map((m) => m.wallet_address.toLowerCase()),
    );

    const leaderboard = await enrichLeaderboardWithUsernames(
      admin,
      await fetchCommunityCampaignLeaderboardFromGraph(
        campaign.on_chain_challenge_id,
        memberWallets,
      ),
    );
    return NextResponse.json({ leaderboard });
  }

  try {
    const leaderboard = await enrichLeaderboardWithUsernames(
      admin,
      await supabaseLeaderboard(admin, id, campaign.community_id),
    );
    return NextResponse.json({ leaderboard });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leaderboard" },
      { status: 500 },
    );
  }
}
