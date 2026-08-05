import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchForfeitCampaignLeaderboardFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import {
  FORFEIT_CAMPAIGN_START_UNIX,
  FORFEIT_CAMPAIGN_END_UNIX,
} from "@/lib/dashboard/campaign-constants";
import { isLeaderboardBlacklisted } from "@/lib/constant";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const rows = await fetchForfeitCampaignLeaderboardFromGraph(
    FORFEIT_CAMPAIGN_START_UNIX,
    FORFEIT_CAMPAIGN_END_UNIX,
  );

  const combined = rows
    .filter((row) => row.forfeited_amount > 0 && !isLeaderboardBlacklisted(row.wallet_address))
    .sort((a, b) => {
      const amountDiff = b.forfeited_amount - a.forfeited_amount;
      if (amountDiff !== 0) return amountDiff;
      // Same total → whoever qualified first ranks higher.
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
    forfeited_amount: row.forfeited_amount,
    qualifying_count: row.qualifying_count,
    username: row.username,
  }));

  let myEntry: { rank: number; forfeited_amount: number } | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) {
      myEntry = { rank: idx + 1, forfeited_amount: enriched[idx].forfeited_amount };
    }
  }

  return NextResponse.json({
    leaderboard: pageRows,
    hasMore: from + PAGE_SIZE < totalCount,
    totalCount,
    myEntry,
    campaignStart: new Date(FORFEIT_CAMPAIGN_START_UNIX * 1000).toISOString(),
    campaignEnd: new Date(FORFEIT_CAMPAIGN_END_UNIX * 1000).toISOString(),
  });
}
