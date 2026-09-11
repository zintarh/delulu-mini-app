import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { payoutReferralReward } from "@/lib/celo/reward-vault-payout";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const REFERRAL_UNLOCK_THRESHOLD = 5;
export const REFERRAL_GDOLLARS_REWARD = 6000;

/**
 * Pays out every not-yet-paid referral credit for a referrer who has reached
 * the unlock threshold. Crossing 4 -> 5 referrals pays all 5 in this same
 * pass (they're all still 'not_eligible' up to that point); every referral
 * after #5 is already past the threshold so it pays on its own the moment
 * it's inserted. Best-effort per row — one failed on-chain call never blocks
 * the others or throws out to the caller (see evaluate.ts).
 */
export async function processReferralPayouts(
  admin: SupabaseAdmin,
  referrerWallet: string,
): Promise<void> {
  const wallet = referrerWallet.toLowerCase();

  const { count } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .eq("referrer_wallet", wallet);
  if (!count || count < REFERRAL_UNLOCK_THRESHOLD) return;

  const { data: payable } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referrer_wallet", wallet)
    .eq("payout_status", "not_eligible")
    .order("credited_at", { ascending: true });

  for (const row of payable ?? []) {
    await payReferralCredit(admin, wallet, String(row.id));
  }
}

/** Pays (or retries) one referral credit row. Used by the retry cron too. */
export async function payReferralCredit(
  admin: SupabaseAdmin,
  referrerWallet: `0x${string}` | string,
  referralCreditId: string,
): Promise<void> {
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
