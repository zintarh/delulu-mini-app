export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { payReferralCredit } from "@/lib/referral/payout";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";
import { REFERRAL_ROUNDS, isReferralCampaignLive } from "@/lib/referral/campaign";

/**
 * Referred friends from this programme with no credit yet. Crediting is
 * event-driven (proof, join, verification), so a friend whose referrer was
 * attached after they'd already earned their points, or whose credit insert
 * failed once, would otherwise never be looked at again.
 */
async function sweepUncreditedReferrals(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  if (!isReferralCampaignLive()) return { checked: 0, credited: 0, errors: 0 };
  const seriesStart = new Date(Math.min(...REFERRAL_ROUNDS.map((r) => Date.parse(r.start)))).toISOString();

  const { data: referred, error } = await admin
    .from("profiles")
    .select("address")
    .not("referred_by", "is", null)
    .gte("created_at", seriesStart)
    .limit(500);
  if (error) throw error;

  const wallets = (referred ?? []).map((r) => String(r.address).toLowerCase());
  if (wallets.length === 0) return { checked: 0, credited: 0, errors: 0 };

  const { data: credited } = await admin
    .from("referral_credits")
    .select("referred_wallet")
    .in("referred_wallet", wallets);
  const done = new Set((credited ?? []).map((c) => String(c.referred_wallet).toLowerCase()));

  let checked = 0;
  let newlyCredited = 0;
  let errors = 0;
  for (const wallet of wallets) {
    if (done.has(wallet)) continue;
    checked++;
    try {
      const result = await evaluateAndCreditReferral(admin, wallet);
      if (result.credited) newlyCredited++;
      else if (result.reason === "budget_reached" || result.reason === "campaign_ended") break;
    } catch (err) {
      errors++;
      console.error(`[cron/referral-payout-retry] evaluate failed for ${wallet}:`, err);
    }
  }
  return { checked, credited: newlyCredited, errors };
}

/**
 * Retries any referral G$ payout whose on-chain deposit previously failed
 * (RPC hiccup, low rewarder balance, etc), and pays out credits held back
 * as 'not_eligible' once their referrer clears the onboarding checklist.
 * Hit hourly by GitHub Actions (.github/workflows/referral-payout-retry.yml), with the once-a-day Vercel
 * cron (vercel.json) as a fallback. payReferralCredit re-checks usedRewardId
 * before sending, so this can never double-credit a referral that actually
 * succeeded despite an earlier error.
 *
 * Proof/weekly/completion rewards have their own upkeep cron:
 * /api/cron/rewards-payouts.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) return errorResponse("Unauthorized", 401);

    const admin = getSupabaseAdmin();
    if (!admin) return errorResponse("Missing Supabase credentials.", 500);

    const { data: failed, error } = await admin
      .from("referral_credits")
      .select("id, referrer_wallet")
      .in("payout_status", ["failed", "not_eligible"])
      .limit(100);
    if (error) return errorResponse(error.message, 500);

    let retried = 0;
    let stillPending = 0;
    for (const row of failed ?? []) {
      const before = row.id;
      await payReferralCredit(admin, row.referrer_wallet, String(row.id));
      const { data: after } = await admin
        .from("referral_credits")
        .select("payout_status")
        .eq("id", before)
        .maybeSingle();
      if (after?.payout_status === "sent") retried++;
      else stillPending++;
    }

    const sweep = await sweepUncreditedReferrals(admin);

    return jsonResponse({ ok: true, found: failed?.length ?? 0, retried, stillPending, sweep });
  } catch (e: any) {
    return errorResponse(e?.message ?? "Cron failed", 500);
  }
}
