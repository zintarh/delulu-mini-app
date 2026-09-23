import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import {
  hasEarnedCampaignProofPointsOnGraph,
  hasQualifyingForfeitProofOnGraph,
} from "@/lib/community/campaign-subgraph";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import { isLeaderboardBlacklisted } from "@/lib/constant";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Matches lib/onboarding/gift.ts's own NEW_USER_CUTOFF_ISO — accounts
 * created before this can never claim the 1,000 G$ gift, so holding the
 * claimedGift step below against them would permanently lock them out of
 * referral eligibility over something they're structurally barred from ever
 * doing. Frozen on purpose (not `new Date()`), so it doesn't drift forward
 * on every redeploy.
 */
const GIFT_REGIME_CUTOFF_ISO = "2026-09-21T00:00:00+01:00";

export type ReferralEligibilitySteps = {
  verified: boolean;
  claimedUbi: boolean;
  claimedGift: boolean;
  completedCampaign: boolean;
};

export type ReferralEligibility = {
  eligible: boolean;
  steps: ReferralEligibilitySteps;
};

const NOT_ELIGIBLE: ReferralEligibility = {
  eligible: false,
  steps: {
    verified: false,
    claimedUbi: false,
    claimedGift: false,
    completedCampaign: false,
  },
};

/**
 * The single definition of "a real, fully-onboarded participant" — used both
 * to decide who appears on the referral leaderboard and whether a wallet is
 * allowed to see/share its own referral link. Someone who only did face
 * verification and stopped is a valid app user, just not a valid *referrer*
 * yet: sharing a link before finishing onboarding is how we end up with
 * referrers who never did anything themselves.
 */
export async function checkReferralEligibility(
  admin: SupabaseAdmin,
  walletAddress: string,
): Promise<ReferralEligibility> {
  const wallet = walletAddress.toLowerCase();

  const { data: profile } = await admin
    .from("profiles")
    .select("onboarding_gift_claimed_at, claim_count, created_at")
    .eq("address", wallet)
    .maybeSingle();

  if (!profile) return NOT_ELIGIBLE;

  const [verified, hasCampaignProof, hasForfeitProof] = await Promise.all([
    isGoodDollarVerified(wallet),
    hasEarnedCampaignProofPointsOnGraph(wallet, BASE_PROOF_POINTS),
    hasQualifyingForfeitProofOnGraph(wallet),
  ]);

  const predatesGiftRegime = !profile.created_at || profile.created_at < GIFT_REGIME_CUTOFF_ISO;

  const steps: ReferralEligibilitySteps = {
    verified,
    claimedUbi: (profile.claim_count ?? 0) >= 1,
    claimedGift: predatesGiftRegime || Boolean(profile.onboarding_gift_claimed_at),
    completedCampaign: hasCampaignProof || hasForfeitProof,
  };

  return { eligible: Object.values(steps).every(Boolean), steps };
}

/**
 * Rollout instant for the "referrer must clear the full onboarding
 * checklist" requirement. A referral credited before this keeps counting
 * under the old, looser rule (just not blacklisted) — grandfathered in so
 * referrals that were already valid under the rules at the time don't get
 * retroactively wiped. Frozen on purpose (not `new Date()`), so it doesn't
 * drift forward on every redeploy.
 */
export const REFERRER_ELIGIBILITY_CUTOFF_ISO = "2026-09-21T00:00:00+01:00";

/**
 * Whether a referral credit counts — for the leaderboard AND for the G$
 * payout. Both must go through this so we never pay for a referral the
 * leaderboard hides (or vice versa). Pass a precomputed eligibility result
 * when checking many credits for the same referrer.
 */
export async function isReferralCreditCountable(
  admin: SupabaseAdmin,
  referrerWallet: string,
  creditedAt: string,
  eligibility?: ReferralEligibility,
): Promise<boolean> {
  if (isLeaderboardBlacklisted(referrerWallet)) return false;
  if (creditedAt < REFERRER_ELIGIBILITY_CUTOFF_ISO) return true;
  const result = eligibility ?? (await checkReferralEligibility(admin, referrerWallet));
  return result.eligible;
}
