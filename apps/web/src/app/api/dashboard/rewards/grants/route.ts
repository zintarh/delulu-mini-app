import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type AdminRewardGrantListItem = {
  id: string;
  recipientAddress: string;
  recipientUsername: string | null;
  recipientEmail: string | null;
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  amountWei: string;
  reason: string | null;
  txHash: string;
  senderAddress: string;
  staffEmail: string | null;
  emailSent: boolean;
  createdAt: string;
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
 * List all admin RewardVault grants for ops tracing.
 * GET /api/dashboard/rewards/grants?query=&page=1&pageSize=25
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

  let q = admin
    .from("admin_reward_grants")
    .select(
      "id, recipient_address, recipient_username, recipient_email, token_address, token_symbol, amount, amount_wei, reason, tx_hash, sender_address, staff_email, email_sent, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query) {
    const term = query.replace(/[%_,]/g, "");
    if (term) {
      q = q.or(
        [
          `recipient_address.ilike.%${term}%`,
          `recipient_username.ilike.%${term}%`,
          `recipient_email.ilike.%${term}%`,
          `sender_address.ilike.%${term}%`,
          `staff_email.ilike.%${term}%`,
          `tx_hash.ilike.%${term}%`,
          `token_symbol.ilike.%${term}%`,
          `reason.ilike.%${term}%`,
        ].join(","),
      );
    }
  }

  const { data, error, count } = await q;

  if (error) {
    console.error("[dashboard/rewards/grants] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grants: AdminRewardGrantListItem[] = (data ?? []).map((row) => ({
    id: String(row.id),
    recipientAddress: String(row.recipient_address ?? ""),
    recipientUsername: row.recipient_username ? String(row.recipient_username) : null,
    recipientEmail: row.recipient_email ? String(row.recipient_email) : null,
    tokenAddress: String(row.token_address ?? ""),
    tokenSymbol: String(row.token_symbol ?? ""),
    amount: Number(row.amount) || 0,
    amountWei: String(row.amount_wei ?? ""),
    reason: row.reason ? String(row.reason) : null,
    txHash: String(row.tx_hash ?? ""),
    senderAddress: String(row.sender_address ?? ""),
    staffEmail: row.staff_email ? String(row.staff_email) : null,
    emailSent: Boolean(row.email_sent),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));

  return NextResponse.json({
    grants,
    total: count ?? grants.length,
    page,
    pageSize,
  });
}
