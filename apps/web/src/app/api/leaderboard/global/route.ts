import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchGlobalAppPointsFromGraph, fetchSeasonPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { SEASON_2_START_MS, isSeason2Live } from "@/lib/season/rules";
import { boardWindow, type BoardWindow } from "@/lib/leaderboard/windows";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { fetchLiveStreaks } from "@/lib/rewards/live-streaks";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

/**
 * GET /api/leaderboard/global
 * ?window=week|fortnight|month: Season points (stake-based) this week / this 2-week round / this month —
 * the boards the app shows. ?season=2: since Season 2 began. ?season=1: all-time.
 */
export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const seasonParam = request.nextUrl.searchParams.get("season");
  const windowParam = request.nextUrl.searchParams.get("window");
  const win: BoardWindow | null = windowParam === "week" || windowParam === "fortnight" || windowParam === "month" ? windowParam : null;
  const range = win ? boardWindow(win) : null;
  const season = seasonParam === "1" ? 1 : seasonParam === "2" || isSeason2Live() ? 2 : 1;
  const rows = range
    ? await fetchSeasonPointsFromGraph(Math.floor(range.startMs / 1000))
    : season === 2
      ? await fetchSeasonPointsFromGraph(Math.floor(SEASON_2_START_MS / 1000))
      : await fetchGlobalAppPointsFromGraph();
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
  const streaks = await fetchLiveStreaks(admin, pageRows.map((r) => r.wallet_address));
  const pageWithStreaks = pageRows.map((r) => ({ ...r, streak: streaks[r.wallet_address.toLowerCase()] ?? 0 }));

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
    season,
    seasonStartsAt: SEASON_2_START_MS,
    window: win,
    startsAt: range?.startMs ?? null,
    endsAt: range?.endMs ?? null,
    leaderboard: pageWithStreaks,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
  });
}
