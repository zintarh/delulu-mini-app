import { NextRequest, NextResponse } from "next/server";
import { fetchJoinedCampaignDashboardFromGraph } from "@/lib/community/campaign-subgraph";
import { isCampaignEndedByDate, PARTICIPATING_STATUSES } from "@/lib/community/campaign-types";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";

export const dynamic = "force-dynamic"; // per-user data, must stay dynamic

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address")?.trim().toLowerCase();
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  // ── 1. On-chain campaigns — milestones come from The Graph ───────────────
  const { data: onChainRows } = await admin
    .from("community_campaigns")
    .select(`
      id, title, cover_image_url, display_ends_at, duration_days, on_chain_challenge_id,
      communities ( name, slug )
    `)
    .in("status", [...PARTICIPATING_STATUSES])
    .not("on_chain_challenge_id", "is", null);

  const challengeIdToCampaign = new Map<
    number,
    {
      id: string;
      title: string;
      community: { name: string; slug: string };
      cover_image_url: string | null;
      display_ends_at: string | null;
      duration_days: number;
    }
  >();

  for (const raw of onChainRows ?? []) {
    const cid = (raw as { on_chain_challenge_id: number | null }).on_chain_challenge_id;
    if (cid == null) continue;
    const endsAt = (raw as { display_ends_at: string | null }).display_ends_at;
    if (isCampaignEndedByDate(endsAt)) continue;
    const community = unwrapRelation(
      (raw as { communities: { name: string; slug: string } | { name: string; slug: string }[] | null })
        .communities,
    );
    challengeIdToCampaign.set(cid, {
      id: (raw as { id: string }).id,
      title: (raw as { title: string }).title,
      community: { name: community?.name ?? "Community", slug: community?.slug ?? "" },
      cover_image_url: (raw as { cover_image_url: string | null }).cover_image_url,
      display_ends_at: endsAt,
      duration_days: Number((raw as { duration_days: number }).duration_days ?? 30),
    });
  }

  const onChainCampaigns = await fetchJoinedCampaignDashboardFromGraph(
    address,
    challengeIdToCampaign,
  );

  // ── 2. Off-chain (pre-launch) campaigns — milestones from Supabase ───────
  // Campaigns without an on_chain_challenge_id are joined via campaign_participants,
  // not tracked on The Graph, so the section above misses them entirely.
  const { data: participantRows } = await admin
    .from("campaign_participants")
    .select("campaign_id")
    .eq("wallet_address", address)
    .eq("status", "joined");

  const joinedIds = (participantRows ?? []).map((p) => p.campaign_id);

  if (joinedIds.length === 0) {
    return NextResponse.json({ campaigns: onChainCampaigns });
  }

  const [offChainCampaignResult, approvedProofsResult] = await Promise.all([
    admin
      .from("community_campaigns")
      .select(`
        id, title, cover_image_url, display_ends_at, duration_days,
        communities ( name, slug )
      `)
      .in("status", [...PARTICIPATING_STATUSES])
      .is("on_chain_challenge_id", null)
      .in("id", joinedIds),
    // Which milestones the user has already submitted proof for (approved)
    admin
      .from("campaign_proof_submissions")
      .select("campaign_id, milestone_id")
      .eq("wallet_address", address)
      .eq("status", "approved")
      .in("campaign_id", joinedIds),
  ]);

  const activeOffChainRows = (offChainCampaignResult.data ?? []).filter(
    (raw) =>
      !isCampaignEndedByDate((raw as { display_ends_at: string | null }).display_ends_at),
  );

  if (activeOffChainRows.length === 0) {
    return NextResponse.json({ campaigns: onChainCampaigns });
  }

  // Map approved proofs: campaignId → Set of completed milestone order_indices
  const completedMap = new Map<string, Set<number>>();
  for (const p of approvedProofsResult.data ?? []) {
    const cid = (p as { campaign_id: string }).campaign_id;
    const mid = (p as { milestone_id: number }).milestone_id;
    if (!completedMap.has(cid)) completedMap.set(cid, new Set());
    completedMap.get(cid)!.add(mid);
  }

  // Fetch all milestones for these campaigns in one query
  const offChainIds = activeOffChainRows.map((r) => (r as { id: string }).id);
  const { data: milestoneRows } = await admin
    .from("campaign_milestones")
    .select("campaign_id, title, order_index")
    .in("campaign_id", offChainIds)
    .order("order_index", { ascending: true });

  const milestonesByCampaign = new Map<string, { title: string; order_index: number }[]>();
  for (const m of milestoneRows ?? []) {
    const cid = (m as { campaign_id: string }).campaign_id;
    if (!milestonesByCampaign.has(cid)) milestonesByCampaign.set(cid, []);
    milestonesByCampaign.get(cid)!.push({
      title: (m as { title: string }).title,
      order_index: Number((m as { order_index: number }).order_index ?? 0),
    });
  }

  const offChainCampaigns = activeOffChainRows.map((raw) => {
    const cid = (raw as { id: string }).id;
    const community = unwrapRelation(
      (raw as {
        communities:
          | { name: string; slug: string }
          | { name: string; slug: string }[]
          | null;
      }).communities,
    );
    const allMilestones = milestonesByCampaign.get(cid) ?? [];
    const completedSet = completedMap.get(cid) ?? new Set<number>();

    // Only milestones not yet approved count as "next"
    const nextMilestones = allMilestones
      .filter((m) => !completedSet.has(m.order_index))
      .map((m) => ({
        milestone_id: m.order_index,
        label: m.title,
        deadline: "",
        start_time: "",
        completed: false as const,
        is_overdue: false as const,
      }));

    return {
      campaign_id: cid,
      challenge_id: 0,
      title: (raw as { title: string }).title,
      community: {
        name: community?.name ?? "Community",
        slug: community?.slug ?? "",
      },
      cover_image_url: (raw as { cover_image_url: string | null }).cover_image_url,
      display_ends_at: (raw as { display_ends_at: string | null }).display_ends_at,
      duration_days: Number((raw as { duration_days: number }).duration_days ?? 30),
      milestone_count: allMilestones.length,
      completed_count: completedSet.size,
      next_milestones: nextMilestones,
    };
  });

  return NextResponse.json({ campaigns: [...onChainCampaigns, ...offChainCampaigns] });
}
