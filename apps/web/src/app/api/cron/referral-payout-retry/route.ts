export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { payReferralCredit } from "@/lib/referral/payout";

/**
 * Retries any referral G$ payout whose on-chain deposit previously failed
 * (RPC hiccup, low rewarder balance, etc). Hit hourly by GitHub Actions
 * (.github/workflows/referral-payout-retry.yml), with the once-a-day Vercel
 * cron (vercel.json) as a fallback. payReferralCredit re-checks usedRewardId
 * before sending, so this can never double-credit a referral that actually
 * succeeded despite an earlier error.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) return errorResponse("Unauthorized", 401);

    const admin = getSupabaseAdmin();
    if (!admin) return errorResponse("Missing Supabase credentials.", 500);

    const { data: failed, error } = await admin
      .from("referral_credits")
      .select("id, referrer_wallet")
      .eq("payout_status", "failed")
      .limit(100);
    if (error) return errorResponse(error.message, 500);

    let retried = 0;
    let stillFailed = 0;
    for (const row of failed ?? []) {
      const before = row.id;
      await payReferralCredit(admin, row.referrer_wallet, String(row.id));
      const { data: after } = await admin
        .from("referral_credits")
        .select("payout_status")
        .eq("id", before)
        .maybeSingle();
      if (after?.payout_status === "sent") retried++;
      else stillFailed++;
    }

    return jsonResponse({ ok: true, found: failed?.length ?? 0, retried, stillFailed });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Cron failed", 500);
  }
}
