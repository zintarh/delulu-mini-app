import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type AdminReferralListItem = {
  id: string;
  referrerAddress: string;
  referrerUsername: string | null;
  referredAddress: string;
  referredUsername: string | null;
  qualifyingAction: "forfeit" | "campaign_join";
  pointsAwarded: number;
  creditedAt: string;
};

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
 * List every counted referral for ops visibility.
 * GET /api/dashboard/referrals?query=&page=1&pageSize=25
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const query = (params.get("query") ?? "").trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const searchFilter = (() => {
    if (!query) return null;
    const term = query.replace(/[%_,]/g, "");
    return term
      ? [`referrer_wallet.ilike.%${term}%`, `referred_wallet.ilike.%${term}%`].join(",")
      : null;
  })();

  let q = admin
    .from("referral_credits")
    .select(
      "id, referrer_wallet, referred_wallet, qualifying_action, points_awarded, credited_at",
      { count: "exact" },
    )
    .order("credited_at", { ascending: false })
    .range(from, to);
  if (searchFilter) q = q.or(searchFilter);

  const { data, error, count } = await q;
  if (error) {
    console.error("[dashboard/referrals] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Total points across ALL matching rows (not just this page).
  let pointsQuery = admin.from("referral_credits").select("points_awarded");
  if (searchFilter) pointsQuery = pointsQuery.or(searchFilter);
  const { data: pointsRows } = await pointsQuery;
  const totalPoints = (pointsRows ?? []).reduce(
    (sum, r) => sum + (Number(r.points_awarded) || 0),
    0,
  );

  const rows = data ?? [];
  const wallets = [
    ...new Set(rows.flatMap((r) => [r.referrer_wallet, r.referred_wallet])),
  ];
  const { data: profiles } =
    wallets.length > 0
      ? await admin.from("profiles").select("address, username").in("address", wallets)
      : { data: [] as Array<{ address: string; username: string | null }> };
  const usernameByAddress = new Map(
    (profiles ?? []).map((p) => [p.address.toLowerCase(), p.username]),
  );

  const referrals: AdminReferralListItem[] = rows.map((row) => ({
    id: String(row.id),
    referrerAddress: String(row.referrer_wallet),
    referrerUsername: usernameByAddress.get(row.referrer_wallet.toLowerCase()) ?? null,
    referredAddress: String(row.referred_wallet),
    referredUsername: usernameByAddress.get(row.referred_wallet.toLowerCase()) ?? null,
    qualifyingAction: row.qualifying_action as "forfeit" | "campaign_join",
    pointsAwarded: Number(row.points_awarded) || 0,
    creditedAt: String(row.credited_at ?? new Date().toISOString()),
  }));

  return NextResponse.json({
    referrals,
    total: count ?? referrals.length,
    totalPoints,
    page,
    pageSize,
  });
}
