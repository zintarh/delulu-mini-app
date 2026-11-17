import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCampaignExpired,
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
      `id, community_campaigns!inner(status, display_ends_at, created_at, duration_days, bingo_cycle_id)`,
    )
    .eq("wallet_address", walletAddress)
    .eq("status", "joined")
    .in("community_campaigns.status", PARTICIPATING_STATUSES)
    .neq("campaign_id", excludeCampaignId)
    // Bingos have their own one-card-per-cycle rule and don't use a campaign slot.
    .is("community_campaigns.bingo_cycle_id", null);

  return (data ?? []).filter((row) => {
    const campaign = Array.isArray(row.community_campaigns)
      ? row.community_campaigns[0]
      : row.community_campaigns;
    if (!campaign) return false;
    return !isCampaignExpired(campaign);
  }).length;
}
