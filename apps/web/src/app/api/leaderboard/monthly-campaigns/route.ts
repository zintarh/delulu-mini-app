import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchMonthlyCampaignPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { monthlyCampaignLeaderboardSinceUnixSeconds } from "@/lib/dashboard/campaign-constants";
import { isLeaderboardBlacklisted } from "@/lib/constant";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
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

  const totalCount = enriched.length;
  const from = page * PAGE_SIZE;
  const pageRows = enriched.slice(from, from + PAGE_SIZE).map((row, idx) => ({
    rank: from + idx + 1,
    wallet_address: row.wallet_address,
    points_total: row.points_total,
    username: row.username,
  }));

  let myEntry: { rank: number; points_total: number } | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) myEntry = { rank: idx + 1, points_total: enriched[idx].points_total };
  }

  return NextResponse.json({
    leaderboard: pageRows,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
    since: new Date(sinceUnixSeconds * 1000).toISOString(),
  });
}
