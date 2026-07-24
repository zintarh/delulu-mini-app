import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { readAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getCommunityMarketV1Address, DELULU_CHAIN_ID } from "@/lib/constant";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";

export const dynamic = "force-dynamic";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
});

export type CampaignOnchainStatus = {
  /** Prize pool is empty on-chain — nothing for winners to claim even once published. */
  needsFunding: boolean;
  poolAmountWei: string;
  /** Sum of participantStake across everyone who's joined — what paid-join has actually collected. */
  totalStakedWei: string;
  /** DB says paid but campaignIsPaid is false on-chain — see approve-campaign-modal.tsx. */
  economicsDrift: boolean;
  /** economicsDrift && nobody has joined yet — still recoverable via setCommunityCampaignEconomics. */
  economicsStillFixable: boolean;
};

/**
 * On-chain health check for deployed campaigns — surfaces the two silent-failure
 * modes found in this codebase: an unfunded prize pool, and paid-join economics
 * that never actually landed on-chain despite the DB believing otherwise. Also
 * reports the total actually collected from paid joins, separate from the prize
 * pool (they're two different on-chain pots — see joinCommunityCampaign).
 *
 * Pass ?ids=uuid1,uuid2 to scope to a specific page of campaigns; omit to check
 * every deployed campaign.
 */
export async function GET(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

  let query = admin
    .from("community_campaigns")
    .select("id, on_chain_challenge_id, is_free_to_join, join_amount")
    .not("on_chain_challenge_id", "is", null);
  if (ids) query = query.in("id", ids);

  const { data: campaigns, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campaigns?.length) return NextResponse.json({ statuses: {} });

  const contract = getCommunityMarketV1Address(DELULU_CHAIN_ID);

  const entries = await Promise.all(
    campaigns.map(async (c) => {
      const challengeId = BigInt(c.on_chain_challenge_id as number);
      const dbWantsPaid = c.is_free_to_join === false && Number(c.join_amount ?? 0) > 0;
      try {
        const [campaign, isPaid, participantCount] = await Promise.all([
          publicClient.readContract({
            address: contract,
            abi: COMMUNITY_CAMPAIGN_ABI,
            functionName: "campaigns",
            args: [challengeId],
          }),
          dbWantsPaid
            ? publicClient.readContract({
                address: contract,
                abi: COMMUNITY_CAMPAIGN_ABI,
                functionName: "campaignIsPaid",
                args: [challengeId],
              })
            : Promise.resolve(null),
          dbWantsPaid
            ? publicClient.readContract({
                address: contract,
                abi: COMMUNITY_CAMPAIGN_ABI,
                functionName: "campaignParticipantCount",
                args: [challengeId],
              })
            : Promise.resolve(null),
        ]);

        const poolAmountWei = (campaign as readonly unknown[])[1] as bigint;
        const economicsDrift = dbWantsPaid && isPaid === false;
        const economicsStillFixable = economicsDrift && (participantCount as bigint | null) === 0n;

        // Sum each participant's on-chain stake — only meaningful once the
        // campaign is genuinely paid; drifted/free campaigns never collected
        // anything regardless of what participantCount says.
        let totalStakedWei = 0n;
        if (dbWantsPaid && isPaid === true) {
          const { data: participants } = await admin
            .from("campaign_participants")
            .select("wallet_address")
            .eq("campaign_id", c.id);

          if (participants?.length) {
            const stakes = await Promise.all(
              participants.map((p) =>
                publicClient.readContract({
                  address: contract,
                  abi: COMMUNITY_CAMPAIGN_ABI,
                  functionName: "participantStake",
                  args: [challengeId, p.wallet_address as `0x${string}`],
                }),
              ),
            );
            totalStakedWei = stakes.reduce((sum, s) => sum + (s as bigint), 0n);
          }
        }

        const status: CampaignOnchainStatus = {
          needsFunding: poolAmountWei === 0n,
          poolAmountWei: poolAmountWei.toString(),
          totalStakedWei: totalStakedWei.toString(),
          economicsDrift,
          economicsStillFixable,
        };
        return [c.id, status] as const;
      } catch {
        // On-chain read failed (RPC blip) — omit rather than report a false status.
        return null;
      }
    }),
  );

  const statuses: Record<string, CampaignOnchainStatus> = {};
  for (const entry of entries) {
    if (entry) statuses[entry[0]] = entry[1];
  }

  return NextResponse.json({ statuses });
}
