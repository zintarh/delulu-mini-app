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
    .select("id, title, description, status")
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

  // Deliberately does NOT flip status to "approved" yet — that only happens once
  // the on-chain deploy actually confirms (see confirm-create/route.ts). This
  // keeps the campaign visibly "pending" (and retryable via the same Approve
  // button) if the wallet transaction fails or is abandoned, instead of leaving
  // the DB claiming "approved" for a campaign that was never deployed on-chain.
  const { data, error } = await admin
    .from("community_campaigns")
    .update({
      content_hash: contentHash,
      updated_at: nowIso,
    })
    .eq("id", id)
    .select("id, status, content_hash")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "content_prepared", session.userId, { content_hash: contentHash });

  return NextResponse.json({ campaign: data });
}
