import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { canPublishDashboardPayouts } from "@/lib/dashboard/campaign-constants";
import {
  buildWinnerPayoutSnapshot,
  persistPayoutSnapshot,
  readOnChainPoolAmountHuman,
} from "@/lib/community/build-payout-snapshot";

export const dynamic = "force-dynamic";

/**
 * (Re)builds the winner payout snapshot using the *current* on-chain poolAmount —
 * deliberately a separate, later step from confirm-end. Call this right before
 * publishing (setCommunityPayoutRoot), not right after ending, so participants
 * have had a real window to call claimCommunityJoinStake first: any stake they
 * forfeit for missed milestones lands back in poolAmount, and this step is what
 * lets that actually reach winners instead of just sitting there unaccounted for.
 *
 * Safe to call repeatedly — persistPayoutSnapshot replaces any prior unpublished
 * snapshot. Blocked once payout_published_at is set (the root is already live
 * on-chain at that point; rebuilding after that would invalidate proofs for
 * anyone who already claimed).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(
      "id, community_id, status, on_chain_challenge_id, proposed_pool_amount, prize_winner_count, payout_published_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin && !session.communityIds.includes(campaign.community_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    !canPublishDashboardPayouts(
      campaign.status,
      campaign.on_chain_challenge_id,
      campaign.payout_published_at,
    )
  ) {
    return NextResponse.json(
      { error: "Campaign must be ended and not yet published to (re)build a snapshot." },
      { status: 400 },
    );
  }

  const { data: participants } = await admin
    .from("campaign_participants")
    .select("wallet_address, points_total")
    .eq("campaign_id", id)
    .order("points_total", { ascending: false });

  let poolAmountHuman: number;
  try {
    poolAmountHuman = await readOnChainPoolAmountHuman(campaign.on_chain_challenge_id as number);
  } catch (err) {
    console.warn(
      "[build-payout-snapshot] on-chain poolAmount read failed, falling back to proposed_pool_amount:",
      err instanceof Error ? err.message : err,
    );
    poolAmountHuman = Number(campaign.proposed_pool_amount ?? 0);
  }

  try {
    const snapshot = buildWinnerPayoutSnapshot({
      campaignIdOnChain: campaign.on_chain_challenge_id as number,
      prizeWinnerCount: Number(campaign.prize_winner_count ?? 10),
      poolAmountHuman,
      leaderboard: (participants ?? []).map((p) => ({
        wallet_address: p.wallet_address,
        points_total: Number(p.points_total ?? 0),
      })),
    });
    await persistPayoutSnapshot(admin, id, snapshot);
    await logCampaignEvent(id, "payout_snapshot_rebuilt", session.userId, {
      merkle_root: snapshot.merkleRoot,
      winner_count: snapshot.winners.length,
      pool_amount_human: poolAmountHuman,
    });

    return NextResponse.json({
      merkleRoot: snapshot.merkleRoot,
      totalClaimableWei: snapshot.totalClaimableWei,
      winnerCount: snapshot.winners.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build payout snapshot" },
      { status: 400 },
    );
  }
}
