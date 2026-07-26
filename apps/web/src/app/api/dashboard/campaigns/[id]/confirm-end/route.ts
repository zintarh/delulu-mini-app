import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import {
  parseCommunityChallengeEndedFromTx,
  readCommunityChallengeEndedOnChain,
} from "@/lib/dashboard/parse-challenge-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { canEndDashboardCampaign } from "@/lib/dashboard/campaign-constants";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rawTxHash = String(body.txHash ?? "").trim();
  const txHash = rawTxHash.startsWith("0x") ? (rawTxHash as `0x${string}`) : null;

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(
      "id, community_id, status, on_chain_challenge_id, proposed_pool_amount, prize_winner_count, payout_merkle_root",
    )
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin && !session.communityIds.includes(campaign.community_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (campaign.on_chain_challenge_id == null) {
    return NextResponse.json({ error: "Campaign has no on-chain challenge." }, { status: 400 });
  }
  if (!canEndDashboardCampaign(campaign.status, campaign.on_chain_challenge_id)) {
    return NextResponse.json({ error: "Campaign cannot be ended in its current state." }, { status: 400 });
  }

  let resynced = false;

  if (campaign.status !== "ended") {
    if (txHash) {
      let parsed;
      try {
        parsed = await parseCommunityChallengeEndedFromTx(txHash);
      } catch (err) {
        const alreadyEnded = await readCommunityChallengeEndedOnChain(campaign.on_chain_challenge_id);
        if (!alreadyEnded) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to read transaction" },
            { status: 400 },
          );
        }
        resynced = true;
      }

      if (!resynced && (!parsed || Number(parsed.challengeId) !== campaign.on_chain_challenge_id)) {
        return NextResponse.json({ error: "CommunityChallengeEnded event not found." }, { status: 400 });
      }
    } else {
      const alreadyEnded = await readCommunityChallengeEndedOnChain(campaign.on_chain_challenge_id);
      if (!alreadyEnded) {
        return NextResponse.json({ error: "Campaign has not ended on-chain yet." }, { status: 400 });
      }
      resynced = true;
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("community_campaigns")
      .update({ status: "ended", ended_at: now, ended_by: session.userId, updated_at: now })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logCampaignEvent(id, "ended", session.userId, {
      tx_hash: txHash,
      resynced_from_onchain_read: resynced,
    });
  }

  // Do not build a payout snapshot here — that must wait until publish so
  // participants can reclaim (and forfeit into the pool) and so we use live
  // subgraph points via build-payout-snapshot.
  const { data } = await admin
    .from("community_campaigns")
    .select(
      "id, status, payout_merkle_root, payout_total_claimable_wei, on_chain_challenge_id, payout_published_at",
    )
    .eq("id", id)
    .single();

  return NextResponse.json({
    campaign: data,
    payout: null,
    resynced,
  });
}
