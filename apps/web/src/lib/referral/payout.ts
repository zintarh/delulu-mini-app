import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { payoutReferralReward } from "@/lib/celo/reward-vault-payout";
import { isReferralCreditCountable } from "@/lib/referral/eligibility";
import { getReferrerStanding } from "@/lib/referral/standing";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const REFERRAL_GDOLLARS_REWARD = 6000;

/**
 * Pays out every not-yet-paid referral credit for a referrer — every
 * successful referral pays on its own the moment it's inserted, as long as
 * the referrer is eligible (see payReferralCredit). Also sweeps up any older rows still sitting
 * 'not_eligible' for the same referrer (e.g. left over from a prior failed
 * lookup), so a transient error here self-heals on the next referral rather
 * than staying stuck forever. Best-effort per row — one failed on-chain call
 * never blocks the others or throws out to the caller (see evaluate.ts).
 */
export async function processReferralPayouts(
  admin: SupabaseAdmin,
  referrerWallet: string,
): Promise<void> {
  const wallet = referrerWallet.toLowerCase();

  const { data: payable, error } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referrer_wallet", wallet)
    .eq("payout_status", "not_eligible")
    .order("credited_at", { ascending: true });

  if (error) {
    console.error(`[referral/payout] lookup failed for ${wallet}:`, error);
    return;
  }

  for (const row of payable ?? []) {
    await payReferralCredit(admin, wallet, String(row.id));
  }
}

/**
 * Pays (or retries) one referral credit row. Used by the retry cron too.
 * Only pays a credit the referral leaderboard would count, and only while the
 * referrer is in good standing (lib/referral/standing.ts) — otherwise the row
 * is parked at 'not_eligible' so the retry cron picks it up once they qualify.
 */
export async function payReferralCredit(
  admin: SupabaseAdmin,
  referrerWallet: `0x${string}` | string,
  referralCreditId: string,
): Promise<void> {
  const { data: credit, error } = await admin
    .from("referral_credits")
    .select("credited_at")
    .eq("id", referralCreditId)
    .maybeSingle();
  if (error || !credit) {
    console.error(`[referral/payout] lookup failed for credit ${referralCreditId}:`, error);
    return;
  }

  // Held (not lost) while the referrer is behind on their own campaign — the
  // retry cron pays it once they've posted today's proof.
  if (
    !(await isReferralCreditCountable(admin, referrerWallet, credit.credited_at)) ||
    (await getReferrerStanding(admin, referrerWallet)).locked
  ) {
    await admin
      .from("referral_credits")
      .update({ payout_status: "not_eligible" })
      .eq("id", referralCreditId);
    return;
  }

  try {
    const result = await payoutReferralReward({
      referrerWallet: referrerWallet as `0x${string}`,
      referralCreditId,
      amountWhole: REFERRAL_GDOLLARS_REWARD,
    });
    await admin
      .from("referral_credits")
      .update({
        payout_status: "sent",
        gdollars_amount: REFERRAL_GDOLLARS_REWARD,
        reward_vault_reward_id: result.rewardId,
        payout_tx_hash: result.txHash,
        paid_at: new Date().toISOString(),
      })
      .eq("id", referralCreditId);
  } catch (err) {
    console.error(`[referral/payout] failed for credit ${referralCreditId}:`, err);
    await admin
      .from("referral_credits")
      .update({ payout_status: "failed", gdollars_amount: REFERRAL_GDOLLARS_REWARD })
      .eq("id", referralCreditId);
  }
}
