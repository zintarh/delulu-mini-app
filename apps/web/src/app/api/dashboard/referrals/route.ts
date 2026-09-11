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
  gdollarsAmount: number;
  payoutStatus: "not_eligible" | "sent" | "failed";
  payoutTxHash: string | null;
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

const VALID_STATUSES = new Set(["not_eligible", "sent", "failed"]);

/**
 * List every counted referral for ops visibility.
 * GET /api/dashboard/referrals?query=&status=&page=1&pageSize=25
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
  const statusParam = params.get("status") ?? "";
  const status = VALID_STATUSES.has(statusParam) ? statusParam : null;
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
      "id, referrer_wallet, referred_wallet, qualifying_action, gdollars_amount, payout_status, payout_tx_hash, credited_at",
      { count: "exact" },
    )
    .order("credited_at", { ascending: false })
    .range(from, to);
  if (searchFilter) q = q.or(searchFilter);
  if (status) q = q.eq("payout_status", status);

  const { data, error, count } = await q;
  if (error) {
    console.error("[dashboard/referrals] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Total G$ paid out across ALL matching rows (not just this page) — always
  // scoped to 'sent' regardless of the status filter, since that's the only
  // status carrying a real gdollars_amount.
  let gdollarsQuery = admin.from("referral_credits").select("gdollars_amount").eq("payout_status", "sent");
  if (searchFilter) gdollarsQuery = gdollarsQuery.or(searchFilter);
  const { data: gdollarsRows } = await gdollarsQuery;
  const totalGDollars = (gdollarsRows ?? []).reduce(
    (sum, r) => sum + (Number(r.gdollars_amount) || 0),
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
    gdollarsAmount: Number(row.gdollars_amount) || 0,
    payoutStatus: row.payout_status as "not_eligible" | "sent" | "failed",
    payoutTxHash: row.payout_tx_hash ?? null,
    creditedAt: String(row.credited_at ?? new Date().toISOString()),
  }));

  return NextResponse.json({
    referrals,
    total: count ?? referrals.length,
    totalGDollars,
    page,
    pageSize,
  });
}
