import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import {
  hasEarnedCampaignProofPointsOnGraph,
  hasQualifyingForfeitProofOnGraph,
} from "@/lib/community/campaign-subgraph";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

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
    .select("onboarding_gift_claimed_at, claim_count")
    .eq("address", wallet)
    .maybeSingle();

  if (!profile) return NOT_ELIGIBLE;

  const [verified, hasCampaignProof, hasForfeitProof] = await Promise.all([
    isGoodDollarVerified(wallet),
    hasEarnedCampaignProofPointsOnGraph(wallet, BASE_PROOF_POINTS),
    hasQualifyingForfeitProofOnGraph(wallet),
  ]);

  const steps: ReferralEligibilitySteps = {
    verified,
    claimedUbi: (profile.claim_count ?? 0) >= 1,
    claimedGift: Boolean(profile.onboarding_gift_claimed_at),
    completedCampaign: hasCampaignProof || hasForfeitProof,
  };

  return { eligible: Object.values(steps).every(Boolean), steps };
}
