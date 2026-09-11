import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const REFERRAL_POINTS = 100;

export type ReferralEvaluationResult =
  | { credited: true }
  | {
      credited: false;
      reason:
        | "no_referrer"
        | "already_credited"
        | "no_qualifying_action"
        | "not_verified";
    };

/**
 * The single shared, idempotent evaluator for whether a referral should be
 * credited. Safe to call redundantly from multiple trigger points (forfeit
 * creation, campaign join, identity verification) — it always re-checks live
 * state, so it converges to the right answer regardless of call order.
 */
export async function evaluateAndCreditReferral(
  admin: SupabaseAdmin,
  walletAddress: string,
): Promise<ReferralEvaluationResult> {
  const wallet = walletAddress.toLowerCase();

  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("address", wallet)
    .maybeSingle();
  if (!profile?.referred_by) return { credited: false, reason: "no_referrer" };

  const { data: existingCredit } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referred_wallet", wallet)
    .maybeSingle();
  if (existingCredit) return { credited: false, reason: "already_credited" };

  let qualifyingAction: "forfeit" | "campaign_join" | null = null;

  const { count: forfeitCount } = await admin
    .from("forfeit_commitments")
    .select("id", { count: "exact", head: true })
    .eq("creator_wallet", wallet);
  if (forfeitCount && forfeitCount > 0) {
    qualifyingAction = "forfeit";
  } else {
    const { count: campaignCount } = await admin
      .from("campaign_participants")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", wallet);
    if (campaignCount && campaignCount > 0) qualifyingAction = "campaign_join";
  }

  if (!qualifyingAction) return { credited: false, reason: "no_qualifying_action" };

  const verified = await isGoodDollarVerified(wallet);
  if (!verified) return { credited: false, reason: "not_verified" };

  const { error } = await admin.from("referral_credits").insert({
    referrer_wallet: profile.referred_by,
    referred_wallet: wallet,
    qualifying_action: qualifyingAction,
    points_awarded: REFERRAL_POINTS,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw error;

  return { credited: true };
}
