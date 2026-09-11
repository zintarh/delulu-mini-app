import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { enrichLeaderboardWithUsernames } from "@/lib/community/enrich-leaderboard-usernames";
import { REFERRAL_UNLOCK_THRESHOLD } from "@/lib/referral/payout";

export const dynamic = "force-dynamic";

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

/** Wallets sitting below the 5-referral unlock threshold, closest first. */
export async function GET() {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: rows, error } = await admin
    .from("referral_leaderboard_v")
    .select("wallet_address, referral_count, last_referral_at")
    .lt("referral_count", REFERRAL_UNLOCK_THRESHOLD)
    .order("referral_count", { ascending: false })
    .order("last_referral_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await enrichLeaderboardWithUsernames(admin, rows ?? []);

  return NextResponse.json({
    wallets: enriched.map((row) => ({
      wallet_address: row.wallet_address,
      username: row.username,
      referral_count: row.referral_count,
      remaining: REFERRAL_UNLOCK_THRESHOLD - row.referral_count,
    })),
  });
}
