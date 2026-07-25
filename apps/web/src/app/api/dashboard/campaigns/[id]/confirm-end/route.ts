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
import {
  buildWinnerPayoutSnapshot,
  persistPayoutSnapshot,
  readOnChainPoolAmountHuman,
} from "@/lib/community/build-payout-snapshot";

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
        // The submitted tx reverted on-chain. This happens when "End Campaign"
        // is retried after an earlier end transaction already succeeded but
        // this DB-sync step never ran (e.g. the tab closed mid-request) — the
        // contract correctly rejects the retry with AlreadyEnded. Rather than
        // surface that as a failure, check live on-chain state: if the
        // challenge is in fact already ended, sync from that instead of
        // requiring the (unrecoverable) original tx hash.
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

  let payout: {
    merkleRoot: string;
    totalClaimableWei: string;
    winnerCount: number;
  } | null = null;

  const { data: fresh } = await admin
    .from("community_campaigns")
    .select("payout_merkle_root, payout_total_claimable_wei")
    .eq("id", id)
    .maybeSingle();

  if (!fresh?.payout_merkle_root) {
    const { data: participants } = await admin
      .from("campaign_participants")
      .select("wallet_address, points_total")
      .eq("campaign_id", id)
      .order("points_total", { ascending: false });

    try {
      let poolAmountHuman: number;
      try {
        poolAmountHuman = await readOnChainPoolAmountHuman(campaign.on_chain_challenge_id);
      } catch (err) {
        console.warn(
          "[confirm-end] on-chain poolAmount read failed, falling back to proposed_pool_amount:",
          err instanceof Error ? err.message : err,
        );
        poolAmountHuman = Number(campaign.proposed_pool_amount ?? 0);
      }

      const snapshot = buildWinnerPayoutSnapshot({
        campaignIdOnChain: campaign.on_chain_challenge_id,
        prizeWinnerCount: Number(campaign.prize_winner_count ?? 10),
        poolAmountHuman,
        leaderboard: (participants ?? []).map((p) => ({
          wallet_address: p.wallet_address,
          points_total: Number(p.points_total ?? 0),
        })),
      });
      await persistPayoutSnapshot(admin, id, snapshot);
      payout = {
        merkleRoot: snapshot.merkleRoot,
        totalClaimableWei: snapshot.totalClaimableWei,
        winnerCount: snapshot.winners.length,
      };
      await logCampaignEvent(id, "payout_snapshot", session.userId, {
        merkle_root: snapshot.merkleRoot,
        winner_count: snapshot.winners.length,
      });
    } catch (err) {
      payout = null;
      console.warn(
        "[confirm-end] payout snapshot skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    payout = {
      merkleRoot: fresh.payout_merkle_root,
      totalClaimableWei: fresh.payout_total_claimable_wei ?? "0",
      winnerCount: 0,
    };
  }

  const { data } = await admin
    .from("community_campaigns")
    .select(
      "id, status, payout_merkle_root, payout_total_claimable_wei, on_chain_challenge_id, payout_published_at",
    )
    .eq("id", id)
    .single();

  return NextResponse.json({
    campaign: data,
    payout,
    resynced,
  });
}
