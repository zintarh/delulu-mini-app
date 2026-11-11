import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { processPayout } from "@/lib/rewards/ledger";

export const dynamic = "force-dynamic";
// Waits up to ~25s for the RewardVault tx to confirm.
export const maxDuration = 60;

/**
 * POST /api/dashboard/reward-engine/retry  { id, reason }
 * Sends a failed or stuck reward now instead of waiting for the cron. Goes
 * through the normal payout path (lease, usedRewardId check, budget, pool),
 * so it can never pay twice. Every attempt is audit-logged.
 */
export async function POST(request: NextRequest) {
  const { session, error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { id?: unknown; reason?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Reward id is required" }, { status: 400 });
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "Add a short reason (3–500 characters)." }, { status: 400 });
  }

  const { data: row, error } = await admin
    .from("reward_payouts")
    .select("id, wallet, category, amount, status")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  if (row.status !== "failed" && row.status !== "pending") {
    return NextResponse.json({ error: `Only failed or pending rewards can be retried (this one is ${row.status}).` }, { status: 409 });
  }

  let statusAfter: string;
  let failure: string | null = null;
  try {
    statusAfter = await processPayout(admin, id, { waitMs: 25_000 });
  } catch (err) {
    statusAfter = "error";
    failure = err instanceof Error ? err.message : String(err);
  }
  const { data: after } = await admin.from("reward_payouts").select("status, tx_hash, last_error").eq("id", id).maybeSingle();

  const { error: auditError } = await admin.from("reward_admin_audit").insert({
    action: "payout_retry",
    actor_id: session.userId,
    actor_email: session.email,
    reason,
    details: {
      payoutId: id,
      wallet: row.wallet,
      category: row.category,
      amount: Number(row.amount),
      statusBefore: row.status,
      statusAfter: after?.status ?? statusAfter,
      txHash: after?.tx_hash ?? null,
      error: failure ?? after?.last_error ?? null,
    },
  });
  if (auditError) console.error("[dashboard/reward-engine/retry] audit insert failed", auditError);

  return NextResponse.json({
    status: after?.status ?? statusAfter,
    txHash: after?.tx_hash ?? null,
    lastError: failure ?? after?.last_error ?? null,
  });
}
