import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { parseCommunityCampaignMilestonesAddedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { computeDisplayEndsAt } from "@/lib/community/campaign-types";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .select("id, community_id, on_chain_challenge_id, status, duration_days, display_ends_at")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.on_chain_challenge_id == null) {
    return NextResponse.json({ error: "Campaign has no on-chain challenge." }, { status: 400 });
  }

  const canAccess =
    isPlatformAdminRole(session.staffRole) ||
    session.communityIds.includes(campaign.community_id);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = await parseCommunityCampaignMilestonesAddedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (!parsed || Number(parsed.challengeId) !== campaign.on_chain_challenge_id) {
    return NextResponse.json(
      { error: "CommunityCampaignMilestonesAdded event not found." },
      { status: 400 },
    );
  }

  await logCampaignEvent(id, "milestones_added", session.userId, {
    tx_hash: txHash,
    milestone_count: Number(parsed.milestoneCount),
  });

  // Start the campaign clock on first milestone publish (if not already set)
  if (!campaign.display_ends_at) {
    const durationDays = Number(campaign.duration_days ?? 30) || 30;
    await admin
      .from("community_campaigns")
      .update({ display_ends_at: computeDisplayEndsAt(durationDays, new Date()), updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    milestoneCount: Number(parsed.milestoneCount),
  });
}
