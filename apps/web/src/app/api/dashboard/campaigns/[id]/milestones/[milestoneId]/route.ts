import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

// DELETE — remove a draft milestone
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, milestoneId } = await params;
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
    return NextResponse.json(
      { error: "Milestones can only be removed from draft or rejected campaigns." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("campaign_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("campaign_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// PATCH — update a draft milestone title or duration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, milestoneId } = await params;
  const body = await request.json().catch(() => ({}));

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
    return NextResponse.json(
      { error: "Milestones can only be edited on draft or rejected campaigns." },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title) patch.title = String(body.title).slice(0, 200).trim();
  if (body.duration_days) patch.duration_days = Math.max(1, Number(body.duration_days));

  const { data, error } = await admin
    .from("campaign_milestones")
    .update(patch)
    .eq("id", milestoneId)
    .eq("campaign_id", id)
    .select("id, title, duration_days, order_index")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestone: data });
}
