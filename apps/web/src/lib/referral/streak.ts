import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { payoutReferralReward } from "@/lib/celo/reward-vault-payout";
import { isReferralCreditCountable } from "@/lib/referral/eligibility";
import { getReferrerStanding } from "@/lib/referral/standing";
import { referralRoundAt, roundFirstPayment } from "@/lib/referral/campaign";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Referral pay comes in two parts (lib/referral/campaign.ts): the first when
 * the friend qualifies (every check the full reward used to need), the rest
 * — this bonus — once the friend has shown up 3 days in a row. We pay most
 * for friends who stay.
 */
export const STREAK_DAYS = 3;

/** Lagos calendar day (UTC+1, no DST). */
const lagosDay = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10);

/** Whether these timestamps cover `n` consecutive Lagos days. Pure. */
export function hasConsecutiveDays(isoTimes: string[], n = STREAK_DAYS): boolean {
  const days = [...new Set(isoTimes.map(lagosDay))].sort();
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86_400_000;
    run = gap === 1 ? run + 1 : 1;
    if (run >= n) return true;
  }
  return days.length > 0 && n <= 1;
}

let missingColumnsWarned = false;

/**
 * Pays the referrer's streak bonus for this referred friend if it's due.
 * Safe to call any time, any number of times (proof approval, hourly cron):
 * a row lock (streak_status) plus the on-chain reward id keep it to one payment.
 */
export async function payReferralStreakBonus(admin: Admin, referredWallet: string): Promise<"paid" | "not_yet" | "skipped" | "failed"> {
  const friend = referredWallet.toLowerCase();
  const { data: credit, error } = await admin
    .from("referral_credits")
    .select("id, referrer_wallet, credited_at, payout_status, streak_status")
    .eq("referred_wallet", friend)
    .maybeSingle();
  if (error) {
    if (/streak_status/.test(error.message) && !missingColumnsWarned) {
      missingColumnsWarned = true;
      console.error("[referral/streak] run docs/migrations/20261118_referral_streak_bonus.sql — bonus payouts are waiting on it");
    }
    return "skipped";
  }
  // The first payment comes first; a paid bonus is done.
  if (!credit || credit.payout_status !== "sent" || credit.streak_status === "sent" || credit.streak_status === "processing") return "skipped";

  const round = referralRoundAt(credit.credited_at as string);
  if (!round) return "skipped";
  const bonus = round.reward - roundFirstPayment(round);
  if (bonus <= 0) return "skipped";

  const { data: proofs } = await admin
    .from("proof_image_fingerprints")
    .select("created_at")
    .eq("status", "accepted")
    .ilike("wallet", friend)
    .limit(500);
  if (!hasConsecutiveDays((proofs ?? []).map((p) => String(p.created_at)))) return "not_yet";

  const referrer = String(credit.referrer_wallet).toLowerCase();
  // Same holds as the first payment: held (not lost) while the referrer isn't eligible or is behind.
  if (
    !(await isReferralCreditCountable(admin, referrer, credit.credited_at as string)) ||
    (await getReferrerStanding(admin, referrer)).locked
  ) {
    await admin.from("referral_credits").update({ streak_status: "not_eligible" }).eq("id", credit.id);
    return "not_yet";
  }

  // Claim the row so two triggers can't both pay.
  const { data: claimed } = await admin
    .from("referral_credits")
    .update({ streak_status: "processing" })
    .eq("id", credit.id)
    .or("streak_status.is.null,streak_status.eq.failed,streak_status.eq.not_eligible")
    .select("id");
  if (!claimed?.length) return "skipped";

  try {
    const result = await payoutReferralReward({
      referrerWallet: referrer as `0x${string}`,
      referralCreditId: `${credit.id}:streak`,
      amountWhole: bonus,
    });
    await admin
      .from("referral_credits")
      .update({ streak_status: "sent", streak_amount: bonus, streak_tx_hash: result.txHash, streak_paid_at: new Date().toISOString() })
      .eq("id", credit.id);
    return "paid";
  } catch (err) {
    console.error(`[referral/streak] bonus failed for credit ${credit.id}:`, err);
    await admin.from("referral_credits").update({ streak_status: "failed", streak_amount: bonus }).eq("id", credit.id);
    return "failed";
  }
}

/** Hourly sweep: every paid first payment whose bonus isn't settled yet. */
export async function sweepReferralStreakBonuses(admin: Admin) {
  const { data, error } = await admin
    .from("referral_credits")
    .select("referred_wallet")
    .eq("payout_status", "sent")
    .or("streak_status.is.null,streak_status.eq.failed,streak_status.eq.not_eligible")
    .gte("credited_at", "2026-11-17T23:00:00Z")
    .limit(300);
  if (error) return { checked: 0, paid: 0, error: error.message };
  let paid = 0;
  for (const row of data ?? []) {
    if ((await payReferralStreakBonus(admin, String(row.referred_wallet))) === "paid") paid++;
  }
  return { checked: data?.length ?? 0, paid };
}
