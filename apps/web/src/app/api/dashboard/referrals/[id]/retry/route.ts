import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { payReferralCredit } from "@/lib/referral/payout";

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

/** Manually retries one failed referral G$ payout. POST /api/dashboard/referrals/:id/retry */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { data: row, error } = await admin
    .from("referral_credits")
    .select("id, referrer_wallet, payout_status")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Referral credit not found" }, { status: 404 });
  if (row.payout_status !== "failed") {
    return NextResponse.json(
      { error: `Only failed payouts can be retried (current status: ${row.payout_status})` },
      { status: 409 },
    );
  }

  // payReferralCredit re-checks usedRewardId on-chain before sending, so this
  // can never double-credit a payout that actually succeeded despite the
  // earlier error.
  await payReferralCredit(admin, row.referrer_wallet, String(row.id));

  const { data: after } = await admin
    .from("referral_credits")
    .select("payout_status, payout_tx_hash, gdollars_amount")
    .eq("id", params.id)
    .maybeSingle();

  return NextResponse.json({ ok: true, referral: after });
}
