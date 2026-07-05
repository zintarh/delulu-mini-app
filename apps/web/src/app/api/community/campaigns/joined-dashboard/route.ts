import { NextRequest, NextResponse } from "next/server";
import { fetchJoinedCampaignDashboardFromGraph } from "@/lib/community/campaign-subgraph";
import {
  buildOffChainMilestoneSchedule,
  getDashboardNextMilestones,
} from "@/lib/community/milestone-submit-eligibility";
import { isCampaignEndedByDate, PARTICIPATING_STATUSES } from "@/lib/community/campaign-types";
import {
  fetchCampaignParticipantAvatars,
  type ParticipantAvatar,
} from "@/lib/community/campaign-participant-avatars";
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
      proof_type, live_camera_duration_seconds,
      is_free_to_join, join_token, join_amount, forfeit_pct,
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
      proof_type: string;
      live_camera_duration_seconds: number | null;
      is_free_to_join: boolean;
      join_token: string;
      join_amount: number;
      forfeit_pct: number;
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
      proof_type: String((raw as { proof_type?: string }).proof_type ?? "screenshot"),
      live_camera_duration_seconds:
        (raw as { live_camera_duration_seconds?: number | null }).live_camera_duration_seconds ??
        null,
      is_free_to_join: (raw as { is_free_to_join?: boolean | null }).is_free_to_join !== false,
      join_token: (raw as { join_token?: string | null }).join_token ?? "G$",
      join_amount: Number((raw as { join_amount?: number | null }).join_amount ?? 0),
      forfeit_pct: Number((raw as { forfeit_pct?: number | null }).forfeit_pct ?? 0),
    });
  }

  const rawOnChainCampaigns = await fetchJoinedCampaignDashboardFromGraph(
    address,
    challengeIdToCampaign,
  );

  // The subgraph reflects on-chain join state, which has no "leave" event —
  // a user who explicitly left (campaign_participants.status = "left") should
  // drop off this list even though they're still enrolled on-chain.
  const onChainCampaignIds = rawOnChainCampaigns.map((c) => c.campaign_id);
  const { data: leftRows } =
    onChainCampaignIds.length > 0
      ? await admin
          .from("campaign_participants")
          .select("campaign_id")
          .eq("wallet_address", address)
          .eq("status", "left")
          .in("campaign_id", onChainCampaignIds)
      : { data: [] };
  const leftOnChainIds = new Set((leftRows ?? []).map((r) => r.campaign_id));
  const onChainCampaigns = rawOnChainCampaigns.filter((c) => !leftOnChainIds.has(c.campaign_id));

  async function withParticipantAvatars<T extends { campaign_id: string }>(
    campaigns: T[],
  ): Promise<Array<T & { participant_avatars: ParticipantAvatar[] }>> {
    const avatarsByCampaign = await fetchCampaignParticipantAvatars(
      admin!,
      campaigns.map((c) => c.campaign_id),
    );
    return campaigns.map((c) => ({
      ...c,
      participant_avatars: avatarsByCampaign.get(c.campaign_id) ?? [],
    }));
  }

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
    return NextResponse.json({ campaigns: await withParticipantAvatars(onChainCampaigns) });
  }

  const [offChainCampaignResult, approvedProofsResult] = await Promise.all([
    admin
      .from("community_campaigns")
      .select(`
        id, title, cover_image_url, display_ends_at, duration_days, proof_cadence,
        proof_type, live_camera_duration_seconds,
        is_free_to_join, join_token, join_amount, forfeit_pct,
        communities ( name, slug )
      `)
      .in("status", [...PARTICIPATING_STATUSES])
      .is("on_chain_challenge_id", null)
      .in("id", joinedIds),
    // Which milestones the user has already submitted proof for (approved)
    admin
      .from("campaign_proof_submissions")
      .select("campaign_id, milestone_id, ai_verdict")
      .eq("wallet_address", address)
      .eq("status", "approved")
      .in("campaign_id", joinedIds),
  ]);

  const activeOffChainRows = (offChainCampaignResult.data ?? []).filter(
    (raw) =>
      !isCampaignEndedByDate((raw as { display_ends_at: string | null }).display_ends_at),
  );

  if (activeOffChainRows.length === 0) {
    return NextResponse.json({ campaigns: await withParticipantAvatars(onChainCampaigns) });
  }

  // Map approved proofs: campaignId → Set of completed milestone order_indices
  const completedMap = new Map<string, Set<number>>();
  for (const p of approvedProofsResult.data ?? []) {
    const cid = (p as { campaign_id: string }).campaign_id;
    const row = p as { milestone_id?: number | null; ai_verdict?: { milestoneId?: number } | null };
    const mid =
      row.milestone_id ??
      (typeof row.ai_verdict?.milestoneId === "number" ? row.ai_verdict.milestoneId : null);
    if (mid == null) continue;
    if (!completedMap.has(cid)) completedMap.set(cid, new Set());
    completedMap.get(cid)!.add(mid);
  }

  // Fetch all milestones + total participant counts for these campaigns in one round-trip
  const offChainIds = activeOffChainRows.map((r) => (r as { id: string }).id);
  const [{ data: milestoneRows }, { data: allParticipantRows }] = await Promise.all([
    admin
      .from("campaign_milestones")
      .select("campaign_id, title, order_index")
      .in("campaign_id", offChainIds)
      .order("order_index", { ascending: true }),
    admin
      .from("campaign_participants")
      .select("campaign_id")
      .in("campaign_id", offChainIds)
      .eq("status", "joined"),
  ]);

  const milestonesByCampaign = new Map<string, { title: string; order_index: number }[]>();
  for (const m of milestoneRows ?? []) {
    const cid = (m as { campaign_id: string }).campaign_id;
    if (!milestonesByCampaign.has(cid)) milestonesByCampaign.set(cid, []);
    milestonesByCampaign.get(cid)!.push({
      title: (m as { title: string }).title,
      order_index: Number((m as { order_index: number }).order_index ?? 0),
    });
  }

  const participantCountByCampaign = new Map<string, number>();
  for (const p of allParticipantRows ?? []) {
    const cid = (p as { campaign_id: string }).campaign_id;
    participantCountByCampaign.set(cid, (participantCountByCampaign.get(cid) ?? 0) + 1);
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
    const scheduled = buildOffChainMilestoneSchedule({
      displayEndsAt: (raw as { display_ends_at: string | null }).display_ends_at,
      durationDays: Number((raw as { duration_days: number }).duration_days ?? 30),
      proofCadence: (raw as { proof_cadence?: string }).proof_cadence ?? "daily",
      milestones: allMilestones,
      completedOrderIndices: completedSet,
    });
    const nextMilestones = getDashboardNextMilestones(scheduled);

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
      proof_type: String((raw as { proof_type?: string }).proof_type ?? "screenshot"),
      live_camera_duration_seconds:
        (raw as { live_camera_duration_seconds?: number | null }).live_camera_duration_seconds ??
        null,
      is_free_to_join: (raw as { is_free_to_join?: boolean | null }).is_free_to_join !== false,
      join_token: (raw as { join_token?: string | null }).join_token ?? "G$",
      join_amount: Number((raw as { join_amount?: number | null }).join_amount ?? 0),
      forfeit_pct: Number((raw as { forfeit_pct?: number | null }).forfeit_pct ?? 0),
      participant_count: participantCountByCampaign.get(cid) ?? 0,
      milestone_count: allMilestones.length,
      completed_count: completedSet.size,
      next_milestones: nextMilestones,
    };
  });

  return NextResponse.json({
    campaigns: await withParticipantAvatars([...onChainCampaigns, ...offChainCampaigns]),
  });
}
