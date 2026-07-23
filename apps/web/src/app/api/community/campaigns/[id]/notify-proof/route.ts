import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export const dynamic = "force-dynamic";

/**
 * Fans a "member submitted proof" notification out to the rest of a
 * campaign's joined participants. Called by the client right after an
 * on-chain proof submission is confirmed indexed (see
 * submitCommunityProofWithWallet in join-campaign-client.ts). Best-effort:
 * has no effect on the submitter's own proof state, so callers should not
 * block on or surface failures from this endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const milestoneId = body.milestoneId;

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, title, communities ( slug )")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const communitySlug = unwrapRelation(campaign.communities)?.slug ?? null;

  const { data: participants } = await admin
    .from("campaign_participants")
    .select("wallet_address")
    .eq("campaign_id", campaignId)
    .eq("status", "joined");

  const recipients = (participants ?? [])
    .map((p) => (p as { wallet_address: string }).wallet_address.toLowerCase())
    .filter((addr) => addr !== walletAddress);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("address", walletAddress)
    .maybeSingle();

  const username = (profile as { username?: string | null } | null)?.username ?? "A member";

  const result = await notifyManyRecipients(admin, recipients, {
    title: "New proof submitted",
    body: `${username} just submitted proof in ${campaign.title}.`,
    url: communitySlug
      ? `/communities/${communitySlug}/campaigns/${campaignId}`
      : "/explore",
    type: "campaign_proof_submitted",
    message: `**${username}** just submitted proof in **${campaign.title}**.`,
    actorAddress: walletAddress,
    eventKeyFor: (addr) =>
      `campaign_proof:${campaignId}:${milestoneId ?? "-"}:${walletAddress}:${addr}`,
  });

  return NextResponse.json({ ok: true, notified: result.sent });
}
