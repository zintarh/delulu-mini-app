import type { getSupabaseAdmin } from "@/lib/push/supabase";

export type ParticipantAvatar = {
  address: string;
  username: string | null;
  pfpUrl: string | null;
};

const MAX_AVATARS_PER_CAMPAIGN = 5;
// Cap on rows fetched across all campaigns in one call so a single hugely
// popular campaign can't blow up the query; generous for the small pages
// (<=50 campaigns) these routes ever fetch avatars for.
const MAX_ROWS_FETCHED = 500;

/**
 * Top few real joiners per campaign (by earliest join), for the "real people,
 * not just a number" avatar stack on campaign cards. Works for both on-chain
 * and off-chain campaigns since campaign_participants mirrors on-chain joins too.
 */
export async function fetchCampaignParticipantAvatars(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  campaignIds: string[],
): Promise<Map<string, ParticipantAvatar[]>> {
  const result = new Map<string, ParticipantAvatar[]>();
  if (campaignIds.length === 0) return result;

  const { data: participantRows } = await admin
    .from("campaign_participants")
    .select("campaign_id, wallet_address, joined_at")
    .in("campaign_id", campaignIds)
    .eq("status", "joined")
    .order("joined_at", { ascending: true })
    .limit(MAX_ROWS_FETCHED);

  const walletsByCampaign = new Map<string, string[]>();
  for (const row of participantRows ?? []) {
    const list = walletsByCampaign.get(row.campaign_id) ?? [];
    if (list.length < MAX_AVATARS_PER_CAMPAIGN) {
      list.push(row.wallet_address);
      walletsByCampaign.set(row.campaign_id, list);
    }
  }

  const addresses = [
    ...new Set([...walletsByCampaign.values()].flat().map((a) => a.toLowerCase())),
  ];
  const { data: profiles } =
    addresses.length > 0
      ? await admin.from("profiles").select("address, username, pfp_url").in("address", addresses)
      : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.address.toLowerCase(),
      { username: p.username ?? null, pfpUrl: p.pfp_url ?? null },
    ]),
  );

  for (const [campaignId, wallets] of walletsByCampaign) {
    result.set(
      campaignId,
      wallets.map((address) => ({
        address,
        username: profileMap.get(address.toLowerCase())?.username ?? null,
        pfpUrl: profileMap.get(address.toLowerCase())?.pfpUrl ?? null,
      })),
    );
  }

  return result;
}
