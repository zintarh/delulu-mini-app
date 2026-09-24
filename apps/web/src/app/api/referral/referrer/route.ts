import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { normalizeReferralCode } from "@/lib/referral/attribution";
import { getReferrerStanding } from "@/lib/referral/standing";
import { sendPushAndNotification } from "@/lib/push/notify-recipients";

export const dynamic = "force-dynamic";

/**
 * Public lookup for the invite landing (/sign-in?ref=CODE): who invited you,
 * and whether their invite is on hold because they're behind on their own
 * campaign. Deliberately minimal — no wallet address or campaign data.
 *
 * When the invite is on hold, nudges the referrer (push + in-app) that
 * someone is waiting on them — at most once per referrer per day.
 */
export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("code"));
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: referrer } = await admin
    .from("profiles")
    .select("address, username, pfp_url")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer) return NextResponse.json({ found: false });

  const address = String(referrer.address).toLowerCase();
  const standing = await getReferrerStanding(admin, address);

  if (standing.locked && standing.campaign) {
    const campaignPath = `/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await sendPushAndNotification({
        supabase: admin,
        recipientAddress: address,
        eventKey: `referral-waiting:${address}:${today}`,
        title: "Someone's waiting on you",
        body: "A friend is trying to join with your invite. Post today's proof to let them in.",
        url: campaignPath,
        type: "campaign_milestone_due",
        message: `A friend is waiting to join with your invite. Post today's proof in ${standing.campaign.title} to let them in.`,
      });
    } catch (err) {
      console.error(`[referral/referrer] notify failed for ${address}:`, err);
    }
  }

  return NextResponse.json({
    found: true,
    username: referrer.username ?? null,
    pfpUrl: referrer.pfp_url ?? null,
    locked: standing.locked,
  });
}
