import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchMonthlyCampaignPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function startOfCurrentMonthUnixSeconds(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0);
  return Math.floor(start / 1000);
}

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const sinceUnixSeconds = startOfCurrentMonthUnixSeconds();
  const sinceIso = new Date(sinceUnixSeconds * 1000).toISOString();

  // Subgraph is source of truth for on-chain campaigns. Only add DB points for
  // campaigns that have no on_chain_challenge_id (legacy / off-chain), so we
  // never double-count or prefer stale zeros.
  const [onChainRows, offChainResult] = await Promise.all([
    fetchMonthlyCampaignPointsFromGraph(sinceUnixSeconds),
    admin
      .from("campaign_participants")
      .select("wallet_address, points_total, community_campaigns(on_chain_challenge_id)")
      .eq("status", "joined")
      .gte("joined_at", sinceIso),
  ]);

  const byWallet = new Map<string, { points_total: number; username: string | null }>();

  for (const row of onChainRows) {
    byWallet.set(row.wallet_address, {
      points_total: row.points_total,
      username: row.username,
    });
  }

  for (const row of offChainResult.data ?? []) {
    const campaignRel = row.community_campaigns as
      | { on_chain_challenge_id: number | null }
      | { on_chain_challenge_id: number | null }[]
      | null;
    const challengeId = Array.isArray(campaignRel)
      ? campaignRel[0]?.on_chain_challenge_id
      : campaignRel?.on_chain_challenge_id;
    // Skip on-chain campaigns — their points come from the subgraph above.
    if (challengeId != null) continue;

    const wallet = row.wallet_address.toLowerCase();
    const existing = byWallet.get(wallet);
    if (existing) {
      existing.points_total += row.points_total ?? 0;
    } else {
      byWallet.set(wallet, { points_total: row.points_total ?? 0, username: null });
    }
  }

  const combined = Array.from(byWallet.entries())
    .map(([wallet_address, v]) => ({
      wallet_address,
      points_total: v.points_total,
      username: v.username,
    }))
    .filter((row) => row.points_total > 0)
    .sort((a, b) => b.points_total - a.points_total);

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
  });
}
