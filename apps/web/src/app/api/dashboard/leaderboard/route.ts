import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { fetchMonthlyCampaignPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { monthlyCampaignLeaderboardSinceUnixSeconds } from "@/lib/dashboard/campaign-constants";
import { isLeaderboardBlacklisted } from "@/lib/constant";

export const dynamic = "force-dynamic";

const TOP_N = 20;

async function requirePlatformAdminSession() {
  const session = await readAdminSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

/**
 * GET /api/dashboard/leaderboard
 * Top 20 users by campaign proof points in the current monthly window.
 */
export async function GET() {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const sinceUnixSeconds = monthlyCampaignLeaderboardSinceUnixSeconds();
  const onChainRows = await fetchMonthlyCampaignPointsFromGraph(sinceUnixSeconds);

  const combined = onChainRows
    .filter((row) => row.points_total > 0 && !isLeaderboardBlacklisted(row.wallet_address))
    .sort((a, b) => {
      const pointsDiff = b.points_total - a.points_total;
      if (pointsDiff !== 0) return pointsDiff;
      // Same total → whoever got there first ranks higher.
      const aTime = a.last_event_at ?? Infinity;
      const bTime = b.last_event_at ?? Infinity;
      return aTime - bTime;
    });

  const enriched = await enrichLeaderboardWithUsernames(admin, combined);
  const top = enriched.slice(0, TOP_N).map((row, idx) => ({
    rank: idx + 1,
    wallet_address: row.wallet_address,
    points_total: row.points_total,
    username: row.username,
  }));

  return NextResponse.json({
    leaderboard: top,
    totalCount: enriched.length,
    period: "month",
    since: new Date(sinceUnixSeconds * 1000).toISOString(),
  });
}
