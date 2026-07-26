import { NextRequest, NextResponse } from "next/server";
import { isCampaignExpired } from "@/lib/community/campaign-types";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
import { fetchBatchCampaignStats } from "@/lib/community/campaign-subgraph";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

/**
 * Campaigns this wallet joined that are over — either `status = ended` or
 * the display end date has passed.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim().toLowerCase();
  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid wallet address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: parts, error: partError } = await admin
    .from("campaign_participants")
    .select("campaign_id")
    .eq("wallet_address", address)
    .eq("status", "joined");

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 });
  }

  const campaignIds = (parts ?? []).map((p) => p.campaign_id as string);
  if (campaignIds.length === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const { data: rows, error } = await admin
    .from("community_campaigns")
    .select(`
      id, title, description, proof_cadence, proposed_pool_amount,
      duration_days, prize_winner_count, cover_image_url, display_ends_at,
      on_chain_challenge_id, status, created_at,
      is_free_to_join, join_token, join_amount, forfeit_pct, proof_instructions, telegram_link,
      communities ( id, name, slug )
    `)
    .in("id", campaignIds)
    .in("status", ["approved", "active", "ended"])
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const endedRows = (rows ?? []).filter(
    (row) =>
      row.status === "ended" ||
      isCampaignExpired({
        display_ends_at: row.display_ends_at,
        created_at: row.created_at,
        duration_days: row.duration_days,
      }),
  );

  if (endedRows.length === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const ids = endedRows.map((c) => c.id);
  const onChainIds = endedRows
    .map((c) => c.on_chain_challenge_id)
    .filter(isValidOnChainChallengeId);

  const [dbMilestoneCounts, batchStats, countRows] = await Promise.all([
    fetchDbMilestoneCounts(admin, ids),
    onChainIds.length > 0
      ? fetchBatchCampaignStats(onChainIds)
      : Promise.resolve(new Map<number, { milestoneCount: number }>()),
    admin
      .from("campaign_participants")
      .select("campaign_id")
      .in("campaign_id", ids)
      .eq("status", "joined")
      .then((res) => res.data ?? []),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countRows) {
    const id = row.campaign_id as string;
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  }

  const campaigns = endedRows.map((c) => {
    const community = unwrapRelation(
      c.communities as
        | { id: string; name: string; slug: string }
        | { id: string; name: string; slug: string }[]
        | null,
    );
    const dbCount = dbMilestoneCounts.get(c.id) ?? 0;
    const graphCount = isValidOnChainChallengeId(c.on_chain_challenge_id)
      ? (batchStats.get(c.on_chain_challenge_id)?.milestoneCount ?? 0)
      : 0;
    const milestoneCount = mergeMilestoneCount(dbCount, graphCount);

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      proofCadence: c.proof_cadence,
      proposedPoolAmount: Number(c.proposed_pool_amount ?? 0),
      durationDays: Number(c.duration_days ?? 30),
      prizeWinnerCount: Number(c.prize_winner_count ?? 0),
      coverImageUrl: c.cover_image_url,
      displayEndsAt: c.display_ends_at,
      createdAt: c.created_at,
      isOnChain: isValidOnChainChallengeId(c.on_chain_challenge_id),
      status: c.status === "ended" ? "ended" : c.status,
      participantCount: countMap.get(c.id) ?? 0,
      milestoneCount,
      canJoin: false,
      isJoined: true,
      isFreeToJoin: c.is_free_to_join !== false,
      joinToken: c.join_token ?? "G$",
      joinAmount: Number(c.join_amount ?? 0),
      forfeitPct: Number(c.forfeit_pct ?? 0),
      proofInstructions: c.proof_instructions ?? null,
      telegramLink: (c as { telegram_link?: string | null }).telegram_link ?? null,
      community: community
        ? { id: community.id, name: community.name, slug: community.slug }
        : null,
    };
  });

  // Newest end / create first
  campaigns.sort((a, b) => {
    const aEnd = a.displayEndsAt ?? a.createdAt ?? "";
    const bEnd = b.displayEndsAt ?? b.createdAt ?? "";
    return bEnd > aEnd ? 1 : bEnd < aEnd ? -1 : 0;
  });

  return NextResponse.json({ campaigns });
}
