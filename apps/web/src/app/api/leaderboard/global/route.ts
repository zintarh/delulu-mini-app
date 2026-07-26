import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchGlobalAppPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/**
 * GET /api/leaderboard/global
 * All-time app points: personal deluluPoints + community campaign points.
 */
export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const rows = await fetchGlobalAppPointsFromGraph();
  const enriched = await enrichLeaderboardWithUsernames(admin, rows);

  const totalCount = enriched.length;
  const from = page * PAGE_SIZE;
  const pageRows = enriched.slice(from, from + PAGE_SIZE).map((row, idx) => ({
    rank: from + idx + 1,
    wallet_address: row.wallet_address,
    points_total: row.points_total,
    username: row.username,
    delulu_points: row.delulu_points,
    campaign_points: row.campaign_points,
  }));

  let myEntry: {
    rank: number;
    points_total: number;
    username: string | null;
  } | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) {
      myEntry = {
        rank: idx + 1,
        points_total: enriched[idx].points_total,
        username: enriched[idx].username,
      };
    }
  }

  return NextResponse.json({
    leaderboard: pageRows,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
  });
}
