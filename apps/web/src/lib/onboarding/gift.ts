import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { payoutOnboardingGift } from "@/lib/celo/reward-vault-payout";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const ONBOARDING_GIFT_GDOLLARS = 1000;

export type OnboardingGiftStatus = "not_eligible" | "sent" | "failed";

export type OnboardingGiftEvaluation = {
  status: OnboardingGiftStatus;
  claimedAt: string | null;
  justGranted: boolean;
};

/**
 * One-time 1000 G$ gift for any wallet that is both GoodDollar-verified and
 * has joined at least one community campaign. Safe to call redundantly from
 * multiple trigger points (campaign join, identity verification) — it
 * re-checks live state every time, so it converges regardless of call order,
 * and never re-grants a wallet already at 'sent' (the on-chain rewardId is
 * also keyed per-wallet, so even a racing double-call can't double-deposit).
 */
export async function evaluateAndCreditOnboardingGift(
  admin: SupabaseAdmin,
  walletAddress: string,
): Promise<OnboardingGiftEvaluation> {
  const wallet = walletAddress.toLowerCase();

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_gift_status, onboarding_gift_claimed_at")
    .eq("address", wallet)
    .maybeSingle();

  if (!profile || profile.onboarding_gift_status === "sent") {
    return {
      status: profile?.onboarding_gift_status ?? "not_eligible",
      claimedAt: profile?.onboarding_gift_claimed_at ?? null,
      justGranted: false,
    };
  }

  const [verified, { count: campaignCount }] = await Promise.all([
    isGoodDollarVerified(wallet),
    admin
      .from("campaign_participants")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet),
  ]);

  if (!verified || !campaignCount) {
    return { status: "not_eligible", claimedAt: null, justGranted: false };
  }

  try {
    const result = await payoutOnboardingGift({
      wallet: wallet as `0x${string}`,
      amountWhole: ONBOARDING_GIFT_GDOLLARS,
    });
    await admin
      .from("profiles")
      .update({
        onboarding_gift_status: "sent",
        onboarding_gift_reward_id: result.rewardId,
        onboarding_gift_tx_hash: result.txHash,
        onboarding_gift_paid_at: new Date().toISOString(),
      })
      .eq("address", wallet);
    return { status: "sent", claimedAt: null, justGranted: true };
  } catch (err) {
    console.error(`[onboarding/gift] deposit failed for ${wallet}:`, err);
    await admin
      .from("profiles")
      .update({ onboarding_gift_status: "failed" })
      .eq("address", wallet);
    return { status: "failed", claimedAt: null, justGranted: false };
  }
}
