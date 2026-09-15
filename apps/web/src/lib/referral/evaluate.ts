import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { processReferralPayouts } from "@/lib/referral/payout";
import {
  hasEarnedCampaignProofPointsOnGraph,
  hasQualifyingForfeitProofOnGraph,
} from "@/lib/community/campaign-subgraph";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const REFERRAL_POINTS = 100;

/**
 * Rollout instant for the "must have earned proof points" requirement below.
 * A referred wallet whose join/Forfeit-create predates this keeps qualifying
 * under the old, looser bar (just the join/create row) — grandfathered in so
 * referrals that were already valid under the rules at the time don't get
 * retroactively invalidated. Frozen on purpose (not `new Date()`), so it
 * doesn't drift forward on every redeploy.
 */
const PROOF_REQUIREMENT_CUTOFF_ISO = "2026-09-15T11:14:38Z";

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
 * creation, campaign join, forfeit/campaign proof approval, identity
 * verification) — it always re-checks live state, so it converges to the
 * right answer regardless of call order.
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

  // Grandfather clause: a join/Forfeit-create from before the proof requirement
  // rolled out still qualifies on its own, same as it always did.
  const { data: legacyForfeit } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("creator_wallet", wallet)
    .lt("created_at", PROOF_REQUIREMENT_CUTOFF_ISO)
    .limit(1)
    .maybeSingle();
  if (legacyForfeit) {
    qualifyingAction = "forfeit";
  } else {
    const { data: legacyJoin } = await admin
      .from("campaign_participants")
      .select("id")
      .eq("wallet_address", wallet)
      .lt("joined_at", PROOF_REQUIREMENT_CUTOFF_ISO)
      .limit(1)
      .maybeSingle();
    if (legacyJoin) qualifyingAction = "campaign_join";
  }

  // From the cutoff on: joining a campaign or creating a Forfeit isn't enough on
  // its own — it must have actually paid off in a real, approved proof (the same
  // 1000-point bar the app awards for a genuine milestone/period completion).
  if (!qualifyingAction) {
    if (await hasQualifyingForfeitProofOnGraph(wallet)) {
      qualifyingAction = "forfeit";
    } else if (await hasEarnedCampaignProofPointsOnGraph(wallet, BASE_PROOF_POINTS)) {
      qualifyingAction = "campaign_join";
    }
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

  // Best-effort — the referral is already credited above regardless of
  // on-chain outcome; a failed/slow RPC call must never fail this function
  // or block whatever action (forfeit/campaign join) triggered it.
  try {
    await processReferralPayouts(admin, profile.referred_by);
  } catch (err) {
    console.error(`[referral/evaluate] payout pass failed for ${profile.referred_by}:`, err);
  }

  return { credited: true };
}
