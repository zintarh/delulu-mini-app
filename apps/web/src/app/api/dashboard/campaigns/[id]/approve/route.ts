import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { uploadCampaignContentHash } from "@/lib/dashboard/campaign-ipfs";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdminRole(session.staffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, title, description, status, proposed_by, community_id, duration_days, communities(name)")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "pending_approval") {
    return NextResponse.json({ error: "Only pending campaigns can be approved." }, { status: 400 });
  }

  let contentHash: string;
  try {
    contentHash = await uploadCampaignContentHash(campaign.title, campaign.description);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to prepare campaign content" },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from("community_campaigns")
    .update({
      status: "approved",
      content_hash: contentHash,
      approved_by: session.userId,
      approved_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id)
    .select("id, status, content_hash")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "approved", session.userId, { content_hash: contentHash });

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
            <p>Your campaign <strong>${campaign.title}</strong> for ${communityName} was approved and is being deployed on-chain.</p>
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
