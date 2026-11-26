import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { processReferralPayouts } from "@/lib/referral/payout";
import { payReferralStreakBonus } from "@/lib/referral/streak";
import { totalProofPointsOnGraph } from "@/lib/community/campaign-subgraph";
import { currentReferralRound, isInCurrentReferralCampaign, isReferralCampaignOver, isReferralPaused } from "@/lib/referral/campaign";
import { roundSlots } from "@/lib/referral/slots";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const REFERRAL_POINTS = 100;
/** A referred friend counts once they've earned this many proof points in total. */
export const REFERRAL_MIN_POINTS = 1000;

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
        | "not_verified"
        | "campaign_ended"
        | "budget_reached"
        | "signed_up_outside_campaign"
        | "partner_referral"
        | "not_staked";
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

  // No new credits (points or G$) once the campaign has ended.
  if (isReferralCampaignOver()) return { credited: false, reason: "campaign_ended" };

  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by, created_at")
    .eq("address", wallet)
    .maybeSingle();
  if (!profile?.referred_by) return { credited: false, reason: "no_referrer" };
  // Only friends who signed up during this campaign count — not leftovers from
  // a previous one, or sign-ups through old links while referrals were off.
  if (!isInCurrentReferralCampaign(profile.created_at as string | null)) {
    return { credited: false, reason: "signed_up_outside_campaign" };
  }

  // Partner links (e.g. /join/BIGJAY) have their own deal: their friends are tracked on the
  // partner's page, never credited the per-friend referral reward (25 Nov 2026).
  if (await isPartnerWallet(admin, String(profile.referred_by))) return { credited: false, reason: "partner_referral" };

  const { data: existingCredit } = await admin
    .from("referral_credits")
    .select("id")
    .eq("referred_wallet", wallet)
    .maybeSingle();
  if (existingCredit) {
    // Already credited: maybe their 3-days-in-a-row bonus is due now (called on every proof approval).
    try {
      await payReferralStreakBonus(admin, wallet);
    } catch (err) {
      console.error(`[referral/evaluate] streak bonus check failed for ${wallet}:`, err);
    }
    return { credited: false, reason: "already_credited" };
  }

  // This week's target is met. A friend who already qualifies is credited when Wednesday's round is checked.
  if (isReferralPaused()) return { credited: false, reason: "budget_reached" };

  let qualifyingAction: "forfeit" | "campaign_join" | "bingo_join" | null = null;

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

  // From the cutoff on: the friend has to have actually played — 1,000 proof
  // points in total across missions, Bingo (weekly and 3-day) and Forfeit goals.
  if (!qualifyingAction) {
    const points = await totalProofPointsOnGraph(wallet);
    if (points.total >= REFERRAL_MIN_POINTS) {
      const { data: bingo } = await admin.from("bingo_attempts").select("id").eq("wallet", wallet).limit(1).maybeSingle();
      qualifyingAction = bingo ? "bingo_join" : points.goals >= points.missions ? "forfeit" : "campaign_join";
    }
  }

  if (!qualifyingAction) return { credited: false, reason: "no_qualifying_action" };

  const verified = await isGoodDollarVerified(wallet);
  if (!verified) return { credited: false, reason: "not_verified" };

  // We pay for friends who put G$ in: they must have staked on a card themselves (25 Nov 2026).
  if (!(await hasStaked(admin, wallet))) return { credited: false, reason: "not_staked" };

  // Each weekly round has a G$ budget: once it's used up, referrals wait for the next round.
  const round = currentReferralRound();
  if (!round) return { credited: false, reason: "campaign_ended" };
  const { count: usedInRound } = await admin
    .from("referral_credits")
    .select("id", { count: "exact", head: true })
    .gte("credited_at", new Date(round.start).toISOString())
    .lt("credited_at", new Date(round.end).toISOString());
  // Spots for this round (set from the admin): once they're taken, nothing more is credited until the next round.
  if ((usedInRound ?? 0) >= (await roundSlots(admin, round))) return { credited: false, reason: "budget_reached" };

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

/** The wallet owns a partner referral code (lib/referral/partners.ts). False before that table exists. */
export async function isPartnerWallet(admin: SupabaseAdmin, wallet: string): Promise<boolean> {
  const { data, error } = await admin.from("referral_partners").select("code").eq("owner_wallet", wallet.toLowerCase()).limit(1);
  return !error && (data ?? []).length > 0;
}

/** Staked real G$ on a card: a Bingo (weekly or daily) or a money Forfeit goal — word pledges don't count. */
export async function hasStaked(admin: SupabaseAdmin, wallet: string): Promise<boolean> {
  const w = wallet.toLowerCase();
  const [{ data: bingo }, { data: goals }] = await Promise.all([
    admin.from("bingo_attempts").select("id").eq("wallet", w).gt("stake_amount", 0).limit(1),
    admin.from("forfeit_commitments").select("stake_amount_wei").eq("creator_wallet", w).limit(50),
  ]);
  if ((bingo ?? []).length) return true;
  return (goals ?? []).some((g) => {
    try {
      return BigInt(String(g.stake_amount_wei ?? "0")) > 0n;
    } catch {
      return false;
    }
  });
}
