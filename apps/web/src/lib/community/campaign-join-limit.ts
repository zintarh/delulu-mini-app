import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCampaignEndedByDate,
  PARTICIPATING_STATUSES,
} from "@/lib/community/campaign-types";

export const CAMPAIGN_JOIN_LIMIT = 2;

/**
 * Counts campaigns a wallet is actively participating in, excluding campaigns
 * that have already ended by display date — an ended campaign frees up a slot
 * even before the owner confirms the on-chain "end" tx and flips DB status.
 */
export async function countActiveJoinedCampaigns(
  admin: SupabaseClient,
  walletAddress: string,
  excludeCampaignId: string,
): Promise<number> {
  const { data } = await admin
    .from("campaign_participants")
    .select(
      `id, community_campaigns!inner(status, display_ends_at)`,
    )
    .eq("wallet_address", walletAddress)
    .eq("status", "joined")
    .in("community_campaigns.status", PARTICIPATING_STATUSES)
    .neq("campaign_id", excludeCampaignId);

  return (data ?? []).filter((row) => {
    const campaign = Array.isArray(row.community_campaigns)
      ? row.community_campaigns[0]
      : row.community_campaigns;
    return !isCampaignEndedByDate(campaign?.display_ends_at ?? null);
  }).length;
}
