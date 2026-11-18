import { NextRequest, NextResponse } from "next/server";
import {
  isCampaignExpired,
  isCampaignParticipatable,
} from "@/lib/community/campaign-types";
import {
  CAMPAIGN_JOIN_LIMIT,
  countActiveJoinedCampaigns,
} from "@/lib/community/campaign-join-limit";
import { fetchCommunityCampaignMilestoneCountFromGraph } from "@/lib/community/campaign-subgraph";
import { fetchCampaignOnchainEconomics } from "@/lib/community/campaign-onchain-economics";
import {
  fetchDbMilestoneCounts,
  isValidOnChainChallengeId,
  mergeMilestoneCount,
} from "@/lib/community/campaign-milestone-counts";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { bingoTierForCampaign, otherTierAttempt } from "@/lib/bingo/attempts";
import { DAY_MS, isBonusTier } from "@/lib/bingo/types";
import { unwrapRelation } from "@/lib/supabase/unwrap-relation";
import { loadStakeRules, stakeGateError } from "@/lib/season/activity";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();

  if (!walletAddress) {
    return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(`
      id, community_id, status, title, display_ends_at, duration_days, created_at, on_chain_challenge_id,
      is_free_to_join, join_amount, join_token, is_hidden,
      communities ( id, name, slug, status )
    `)
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  // Bingo tier rows stay hidden from every campaign list (old app versions
  // included) — they're joined from their Bingo, so hidden doesn't block them.
  const bingoTier = await bingoTierForCampaign(admin, campaignId);
  if (campaign.is_hidden && !bingoTier) {
    return NextResponse.json({ error: "Mission is not open for participation" }, { status: 400 });
  }
  if (!isCampaignParticipatable(campaign.status)) {
    return NextResponse.json({ error: "Mission is not open for participation" }, { status: 400 });
  }
  if (isCampaignExpired(campaign)) {
    return NextResponse.json({ error: "Mission has ended" }, { status: 400 });
  }

  // ── Bingo tiers: one card per cycle, no regular campaign slot ──────────
  if (bingoTier && isBonusTier(bingoTier.tier_key)) {
    // A bonus square's free campaign: only for players with a card in this cycle, any day it runs.
    const { data: card } = await admin
      .from("bingo_attempts")
      .select("id")
      .eq("cycle_id", bingoTier.cycle.id)
      .eq("wallet", walletAddress)
      .maybeSingle();
    if (!card || bingoTier.setup_step !== "ready" || Date.now() >= Date.parse(bingoTier.cycle.ends_at)) {
      return NextResponse.json({ error: "Join the Bingo first to fill bonus squares." }, { status: 400 });
    }
  } else if (bingoTier) {
    const lastDayStarts = Date.parse(bingoTier.cycle.ends_at) - DAY_MS;
    if (bingoTier.cycle.status !== "ready" || bingoTier.setup_step !== "ready" || Date.now() >= lastDayStarts) {
      return NextResponse.json({ error: "Joining for this Bingo is closed." }, { status: 400 });
    }
    const other = await otherTierAttempt(admin, bingoTier.cycle.id, walletAddress, bingoTier.id);
    if (other) {
      return NextResponse.json({ error: "You're already playing this Bingo." }, { status: 409 });
    }
  }

  // ── Season 2 minimum stake (bonus squares are free extras for card holders) ──
  if (!(bingoTier && isBonusTier(bingoTier.tier_key))) {
    const rules = await loadStakeRules(admin, walletAddress);
    const joinAmount = campaign.is_free_to_join ? 0 : Number(campaign.join_amount ?? 0);
    // A free campaign is never a word pledge — it needs the minimum like any other.
    const gate = rules.live && joinAmount < rules.minStake ? stakeGateError({ ...rules, canPledgeWord: false }, joinAmount) : null;
    if (gate) {
      return NextResponse.json({ error: gate, code: "stake_below_min", minStake: rules.minStake }, { status: 403 });
    }
  }

  // ── join limit (ended campaigns free up a slot) ────────────────────────
  const activeCount = bingoTier ? 0 : await countActiveJoinedCampaigns(admin, walletAddress, campaignId);

  if (activeCount >= CAMPAIGN_JOIN_LIMIT) {
    return NextResponse.json(
      {
        error: `You can only join ${CAMPAIGN_JOIN_LIMIT} campaigns at a time. Complete or wait for your active campaigns to end to join another.`,
      },
      { status: 403 },
    );
  }
  // ──────────────────────────────────────────────────────────────────────

  const community = unwrapRelation(campaign.communities);

  if (!community || community.status !== "active") {
    return NextResponse.json({ error: "Community is not active" }, { status: 403 });
  }

  const { data: membership } = await admin
    .from("community_members")
    .select("id, status")
    .eq("community_id", campaign.community_id)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  const joinedCommunity = Boolean(membership?.status === "active");

  if (isValidOnChainChallengeId(campaign.on_chain_challenge_id)) {
    const challengeId = campaign.on_chain_challenge_id;
    const [graphCount, dbCounts] = await Promise.all([
      fetchCommunityCampaignMilestoneCountFromGraph(challengeId),
      fetchDbMilestoneCounts(admin, [campaignId]),
    ]);
    const milestoneCount = mergeMilestoneCount(
      dbCounts.get(campaignId) ?? 0,
      graphCount,
    );
    if (graphCount === 0) {
      return NextResponse.json(
        {
          error:
            milestoneCount > 0
              ? "Milestones are being finalized on-chain. Try again shortly."
              : "Owner is setting up milestones on-chain",
          milestoneCount,
        },
        { status: 403 },
      );
    }

    const onchain = await fetchCampaignOnchainEconomics(challengeId);

    return NextResponse.json({
      ok: true,
      requiresOnChain: true,
      challengeId,
      joinedCommunity,
      milestoneCount,
      isPaidOnChain: onchain?.isPaid ?? false,
      joinAmountOnChain: onchain?.joinAmount ?? 0,
      joinTokenOnChain: onchain?.joinTokenLabel ?? campaign.join_token ?? "G$",
      community: { id: community.id, name: community.name, slug: community.slug },
    });
  }

  // Approved/active campaigns must be registered on-chain before joining.
  return NextResponse.json(
    {
      error:
        "This mission is not live on-chain yet. The community owner must complete on-chain registration before members can join.",
    },
    { status: 403 },
  );
}
