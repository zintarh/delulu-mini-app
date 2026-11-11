import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export type RewardAuditRow = {
  id: string;
  action: "config_update" | "payout_retry";
  actorEmail: string;
  reason: string;
  details: Record<string, unknown>;
  createdAt: string;
};

/** GET /api/dashboard/reward-engine/audit?page= — settings changes and manual actions, newest first. */
export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await admin
    .from("reward_admin_audit")
    .select("id, action, actor_email, reason, details, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: RewardAuditRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    action: r.action as RewardAuditRow["action"],
    actorEmail: r.actor_email as string,
    reason: r.reason as string,
    details: (r.details as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
  return NextResponse.json({ rows, total: count ?? rows.length, page, pageSize: PAGE_SIZE });
}
