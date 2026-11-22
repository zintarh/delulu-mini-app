import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchJoinedCampaignDashboard } from "@/lib/community/joined-dashboard";
import { getActiveMilestone } from "@/lib/community/milestone-submit-eligibility";
import { sendPushAndNotification } from "@/lib/push/notify-recipients";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type ReferrerStanding = {
  /** Referral payouts held until today's proof is in. */
  locked: boolean;
  /** The campaign holding them back — where "submit today's proof" should link. */
  campaign: { id: string; title: string; slug: string } | null;
  missedCount: number;
};

const UNLOCKED: ReferrerStanding = { locked: false, campaign: null, missedCount: 0 };

/**
 * Referral accountability: a referrer who has missed a milestone in an active
 * campaign is locked while today's milestone is still open and unsubmitted.
 * Posting today's proof unlocks them for the day. While locked, friends still
 * sign up through their link as normal; only the referrer's referral payouts
 * (first part and 3-day bonus) are held, and the retry cron pays them out
 * once the proof is in.
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

/**
 * Tells a locked referrer that referral money is waiting on today's proof.
 * At most once per referrer per day (payout and streak bonus share the key),
 * and never throws: a failed push must not affect the payout bookkeeping.
 */
export async function notifyReferralPayoutHeld(
  admin: SupabaseAdmin,
  walletAddress: string,
  standing: ReferrerStanding,
): Promise<void> {
  if (!standing.locked || !standing.campaign) return;
  const address = walletAddress.toLowerCase();
  const campaignPath = `/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await sendPushAndNotification({
      supabase: admin,
      recipientAddress: address,
      eventKey: `referral-held:${address}:${today}`,
      title: "Your referral money is waiting",
      body: "A friend you invited counts. Post today's proof to get paid.",
      url: campaignPath,
      type: "campaign_milestone_due",
      message: `A friend you invited counts. Post today's proof in ${standing.campaign.title} to get your referral money.`,
    });
  } catch (err) {
    console.error(`[referral/standing] held-payout notify failed for ${address}:`, err);
  }
}
