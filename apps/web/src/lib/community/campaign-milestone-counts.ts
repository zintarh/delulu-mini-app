import type { SupabaseClient } from "@supabase/supabase-js";

/** Count planned milestones in Supabase (draft / pre-on-chain). */
export async function fetchDbMilestoneCounts(
  admin: SupabaseClient,
  campaignIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (campaignIds.length === 0) return map;

  const { data, error } = await admin
    .from("campaign_milestones")
    .select("campaign_id")
    .in("campaign_id", campaignIds);

  if (error) {
    console.error("[campaign_milestones] count error:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = String(row.campaign_id);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export function mergeMilestoneCount(dbCount: number, graphCount: number): number {
  return Math.max(dbCount, graphCount);
}

/** Treat 0 as unset — some rows store 0 instead of null before on-chain deploy. */
export function isValidOnChainChallengeId(id: number | null | undefined): id is number {
  return typeof id === "number" && id > 0;
}
