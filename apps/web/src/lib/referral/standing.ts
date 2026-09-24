import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchJoinedCampaignDashboard } from "@/lib/community/joined-dashboard";
import { getActiveMilestone } from "@/lib/community/milestone-submit-eligibility";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type ReferrerStanding = {
  /** Referral powers suspended until today's proof is in. */
  locked: boolean;
  /** The campaign holding them back — where "submit today's proof" should link. */
  campaign: { id: string; title: string; slug: string } | null;
  missedCount: number;
};

const UNLOCKED: ReferrerStanding = { locked: false, campaign: null, missedCount: 0 };

/**
 * Referral accountability: a referrer who has missed a milestone in an active
 * campaign is locked while today's milestone is still open and unsubmitted.
 * Posting today's proof unlocks them for the day. While locked, invitees
 * can't sign up through their link and their referral payouts are held.
 *
 * Fails open — an RPC/subgraph error must never block someone's sign-up.
 */
export async function getReferrerStanding(
  admin: SupabaseAdmin,
  walletAddress: string,
): Promise<ReferrerStanding> {
  try {
    const campaigns = await fetchJoinedCampaignDashboard(admin, walletAddress.toLowerCase(), {
      withAvatars: false,
    });
    const behind = campaigns.find(
      (c) => c.missed_count > 0 && getActiveMilestone(c.next_milestones) != null,
    );
    if (!behind) return UNLOCKED;
    return {
      locked: true,
      campaign: {
        id: behind.campaign_id,
        title: behind.title.replace(/\s+/g, " ").trim(),
        slug: behind.community.slug,
      },
      missedCount: behind.missed_count,
    };
  } catch (err) {
    console.error(`[referral/standing] check failed for ${walletAddress}:`, err);
    return UNLOCKED;
  }
}
