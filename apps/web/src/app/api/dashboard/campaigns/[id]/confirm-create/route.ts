import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { parseCommunityChallengeCreatedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdminRole(session.staffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim() as `0x${string}`;
  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(
      "id, title, description, status, content_hash, on_chain_challenge_id, proposed_by, community_id, communities(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.on_chain_challenge_id != null) {
    return NextResponse.json({
      campaign: { id: campaign.id, on_chain_challenge_id: campaign.on_chain_challenge_id },
      alreadyLinked: true,
    });
  }
  if (!["approved", "pending_approval"].includes(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not ready for on-chain create." }, { status: 400 });
  }

  let challengeId: bigint | null;
  try {
    challengeId = await parseCommunityChallengeCreatedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (challengeId == null) {
    return NextResponse.json({ error: "CommunityChallengeCreated event not found in transaction." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("community_campaigns")
    .update({
      status: "approved",
      on_chain_challenge_id: Number(challengeId),
      approved_by: session.userId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, status, on_chain_challenge_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Challenge ID already linked to another campaign." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Campaign is only truly "approved" once it's live on-chain — log both facts
  // together here rather than at the earlier content-prep step.
  await logCampaignEvent(id, "approved", session.userId, { content_hash: campaign.content_hash });
  await logCampaignEvent(id, "on_chain_created", session.userId, {
    tx_hash: txHash,
    on_chain_challenge_id: Number(challengeId),
  });

  if (campaign.proposed_by) {
    const { data: proposer } = await admin
      .from("staff_users")
      .select("email")
      .eq("id", campaign.proposed_by)
      .maybeSingle();

    const communityName =
      (campaign.communities as { name?: string } | null)?.name ?? "your community";
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/communities/${campaign.community_id}/campaigns/${id}`;

    if (proposer?.email) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "noreply@delulu.app",
          to: proposer.email,
          subject: `Campaign approved: ${campaign.title}`,
          html: `
            <p>Your campaign <strong>${campaign.title}</strong> for ${communityName} was approved and deployed on-chain.</p>
            <p>Once milestones are added on-chain, members will be able to join and compete. A platform admin can fund the prize pool separately — points and the leaderboard go live when the first member joins.</p>
            <p><a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View campaign</a></p>
          `,
        });
        await logCampaignEvent(id, "approved_notified", session.userId);
      } catch {
        // non-fatal
      }
    }
  }

  return NextResponse.json({ campaign: data });
}
