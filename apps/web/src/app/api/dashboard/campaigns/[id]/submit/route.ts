import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, community_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin && !session.communityIds.includes(campaign.community_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["draft", "rejected"].includes(campaign.status)) {
    return NextResponse.json({ error: "Campaign cannot be submitted in its current state." }, { status: 400 });
  }

  const { count: milestoneCount } = await admin
    .from("campaign_milestones")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);

  if (!milestoneCount || milestoneCount === 0) {
    return NextResponse.json(
      { error: "Add at least one milestone before submitting for approval." },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("community_campaigns")
    .update({
      status: "pending_approval",
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCampaignEvent(id, "submitted", session.userId);

  return NextResponse.json({ campaign: data });
}
