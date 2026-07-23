import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  getAddress,
  http,
  zeroAddress,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import {
  DELULU_CHAIN_ID,
  getCommunityMarketV1Address,
  GOODDOLLAR_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
} from "@/lib/constant";

export const dynamic = "force-dynamic";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
});

export type ReclaimableStakeItem = {
  campaignId: string;
  title: string;
  communitySlug: string | null;
  communityName: string | null;
  onChainChallengeId: number;
  amountWei: string;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  /** What you'll actually receive after the missed-milestone forfeit — same units as amountWei. */
  netAmountWei: string;
  missedMilestones: number;
  totalMilestones: number;
  forfeitPctPerMiss: number;
};

/**
 * GET /api/community/campaigns/reclaimable-stakes?address=0x…
 * Ended paid campaigns where the wallet still has an on-chain join stake.
 */
export async function GET(request: NextRequest) {
  const addressRaw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!addressRaw.startsWith("0x") || addressRaw.length < 42) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  let wallet: Address;
  try {
    wallet = getAddress(addressRaw as Address);
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const walletLower = wallet.toLowerCase();

  // Any row here means an on-chain CommunityCampaignJoined event was already
  // verified for this wallet (see confirm-join) — a paid stake was pulled at
  // that point. "Leaving" a campaign only ever updates this DB status; it has
  // no on-chain effect and never refunds the stake, so status must not be used
  // to gate eligibility here. The on-chain participantStake read below is the
  // actual source of truth for whether anything is still reclaimable.
  const { data: participations, error: partError } = await admin
    .from("campaign_participants")
    .select("campaign_id")
    .eq("wallet_address", walletLower);

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 });
  }
  if (!participations?.length) {
    return NextResponse.json({ items: [] as ReclaimableStakeItem[] });
  }

  const campaignIds = [...new Set(participations.map((p) => p.campaign_id))];

  const { data: campaigns, error: campaignsError } = await admin
    .from("community_campaigns")
    .select(
      "id, title, status, on_chain_challenge_id, is_free_to_join, join_token, communities(name, slug)",
    )
    .in("id", campaignIds)
    .eq("status", "ended")
    .eq("is_free_to_join", false)
    .not("on_chain_challenge_id", "is", null);

  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }
  if (!campaigns?.length) {
    return NextResponse.json({ items: [] as ReclaimableStakeItem[] });
  }

  let contract: `0x${string}`;
  try {
    contract = getCommunityMarketV1Address(DELULU_CHAIN_ID);
  } catch {
    return NextResponse.json({ items: [] as ReclaimableStakeItem[] });
  }

  const items: ReclaimableStakeItem[] = [];

  // Parallel stake reads — typically a small set of ended paid campaigns per wallet.
  const stakeReads = await Promise.all(
    campaigns.map(async (campaign) => {
      const challengeId = campaign.on_chain_challenge_id as number;
      try {
        const [stakeWei, joinTokenRaw, totalMilestones, completed, forfeitPctPerMiss] =
          await Promise.all([
            publicClient.readContract({
              address: contract,
              abi: COMMUNITY_CAMPAIGN_ABI,
              functionName: "participantStake",
              args: [BigInt(challengeId), wallet],
            }),
            publicClient.readContract({
              address: contract,
              abi: COMMUNITY_CAMPAIGN_ABI,
              functionName: "campaignJoinToken",
              args: [BigInt(challengeId)],
            }),
            publicClient.readContract({
              address: contract,
              abi: COMMUNITY_CAMPAIGN_ABI,
              functionName: "campaignMilestoneCount",
              args: [BigInt(challengeId)],
            }),
            publicClient.readContract({
              address: contract,
              abi: COMMUNITY_CAMPAIGN_ABI,
              functionName: "participantCompletedMilestones",
              args: [BigInt(challengeId), wallet],
            }),
            publicClient.readContract({
              address: contract,
              abi: COMMUNITY_CAMPAIGN_ABI,
              functionName: "campaignForfeitPct",
              args: [BigInt(challengeId)],
            }),
          ]);
        return {
          campaign,
          challengeId,
          stakeWei: stakeWei as bigint,
          joinTokenRaw,
          totalMilestones: Number(totalMilestones),
          completed: Number(completed),
          forfeitPctPerMiss: Number(forfeitPctPerMiss),
        };
      } catch {
        return {
          campaign,
          challengeId,
          stakeWei: 0n,
          joinTokenRaw: zeroAddress,
          totalMilestones: 0,
          completed: 0,
          forfeitPctPerMiss: 0,
        };
      }
    }),
  );

  for (const row of stakeReads) {
    if (row.stakeWei <= 0n) continue;

    const tokenAddress = (
      row.joinTokenRaw === zeroAddress
        ? GOODDOLLAR_ADDRESSES.mainnet
        : (row.joinTokenRaw as `0x${string}`)
    ) as `0x${string}`;
    const tokenSymbol =
      KNOWN_TOKEN_SYMBOLS[tokenAddress.toLowerCase()] ??
      (row.joinTokenRaw === zeroAddress ? "G$" : "TOKEN");

    const community = Array.isArray(row.campaign.communities)
      ? row.campaign.communities[0]
      : row.campaign.communities;

    const missed = Math.max(0, row.totalMilestones - row.completed);
    const totalForfeitPct = Math.min(100, row.forfeitPctPerMiss * missed);
    // Mirror the contract's exact order of operations (forfeited amount first,
    // then subtracted) rather than computing the complement directly — integer
    // division means those two approaches can round to different wei values.
    const forfeitedWei = (row.stakeWei * BigInt(totalForfeitPct)) / 100n;
    const netAmountWei = row.stakeWei - forfeitedWei;

    items.push({
      campaignId: row.campaign.id,
      title: row.campaign.title ?? "Campaign",
      communitySlug: community?.slug ?? null,
      communityName: community?.name ?? null,
      onChainChallengeId: row.challengeId,
      amountWei: row.stakeWei.toString(),
      tokenAddress,
      tokenSymbol,
      netAmountWei: netAmountWei.toString(),
      missedMilestones: missed,
      totalMilestones: row.totalMilestones,
      forfeitPctPerMiss: row.forfeitPctPerMiss,
    });
  }

  items.sort((a, b) => {
    const diff = BigInt(b.amountWei) - BigInt(a.amountWei);
    if (diff > 0n) return 1;
    if (diff < 0n) return -1;
    return 0;
  });

  return NextResponse.json({ items });
}
