import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { fetchMonthlyCampaignPointsFromGraph } from "@/lib/community/campaign-subgraph";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";

export const dynamic = "force-dynamic";

const TOP_N = 20;

function startOfCurrentMonthUnixSeconds(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0);
  return Math.floor(start / 1000);
}

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
 * Top 20 users by campaign points this month (platform admin).
 */
export async function GET() {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const sinceUnixSeconds = startOfCurrentMonthUnixSeconds();
  const sinceIso = new Date(sinceUnixSeconds * 1000).toISOString();

  const [onChainRows, offChainResult] = await Promise.all([
    fetchMonthlyCampaignPointsFromGraph(sinceUnixSeconds),
    admin
      .from("campaign_participants")
      .select("wallet_address, points_total")
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
  });
}
