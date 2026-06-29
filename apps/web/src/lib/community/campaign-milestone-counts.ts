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

/** Returns true for any non-null number, including 0 (valid first campaign ID on a fresh contract). */
export function isValidOnChainChallengeId(id: number | null | undefined): id is number {
  return typeof id === "number" && id >= 0;
}
