import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { isLeaderboardBlacklisted } from "@/lib/constant";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? "0") || 0);
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase() || null;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: rows, error } = await admin
    .from("referral_leaderboard_v")
    .select("wallet_address, referral_count, gdollars_amount, last_referral_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (rows ?? []).filter((row) => !isLeaderboardBlacklisted(row.wallet_address));

  const sorted = filtered.sort((a, b) => {
    const countDiff = b.referral_count - a.referral_count;
    if (countDiff !== 0) return countDiff;
    // Tie → whoever hit that count first ranks higher.
    return new Date(a.last_referral_at).getTime() - new Date(b.last_referral_at).getTime();
  });

  const enriched = await enrichLeaderboardWithUsernames(admin, sorted);

  const totalCount = enriched.length;
  const from = page * PAGE_SIZE;
  const pageRows = enriched.slice(from, from + PAGE_SIZE).map((row, idx) => ({
    rank: from + idx + 1,
    wallet_address: row.wallet_address,
    username: row.username,
    referral_count: row.referral_count,
    gdollars_amount: row.gdollars_amount,
  }));

  let myEntry: (typeof pageRows)[number] | null = null;
  if (address) {
    const idx = enriched.findIndex((row) => row.wallet_address.toLowerCase() === address);
    if (idx !== -1) {
      const row = enriched[idx];
      myEntry = {
        rank: idx + 1,
        wallet_address: row.wallet_address,
        username: row.username,
        referral_count: row.referral_count,
        gdollars_amount: row.gdollars_amount,
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
