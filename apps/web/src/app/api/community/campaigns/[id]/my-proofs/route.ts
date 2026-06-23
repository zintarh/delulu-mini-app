import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { fetchCommunityCampaignMilestonesFromGraph } from "@/lib/community/campaign-subgraph";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const address = new URL(request.url).searchParams.get("address")?.trim().toLowerCase() ?? undefined;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("on_chain_challenge_id")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  if (campaign.on_chain_challenge_id) {
    const milestones = await fetchCommunityCampaignMilestonesFromGraph(
      campaign.on_chain_challenge_id,
      address,
    );
    const completedCount = milestones.filter((m) => m.completed).length;
    return NextResponse.json({
      milestones,
      milestoneCount: milestones.length,
      completedCount,
    });
  }

  const { data: dbMilestones } = await admin
    .from("campaign_milestones")
    .select("id, title, duration_days, order_index")
    .eq("campaign_id", id)
    .order("order_index", { ascending: true });

  const planned = dbMilestones ?? [];
  const milestones = planned.map((m, i) => ({
    milestone_id: i + 1,
    label: m.title,
    deadline: "",
    start_time: "",
    completed: false,
    is_overdue: false,
  }));

  return NextResponse.json({
    milestones,
    milestoneCount: planned.length,
    completedCount: 0,
  });
}
