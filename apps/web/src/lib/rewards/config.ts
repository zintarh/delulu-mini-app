import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { DEFAULT_REWARDS_CONFIG, resolveRewardsConfig, type RewardsConfig } from "@/lib/rewards/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const CACHE_MS = 60_000;
let cached: { config: RewardsConfig; at: number } | null = null;

/**
 * Reward amounts and limits: code defaults (rules.ts) overlaid with the
 * `reward_config` row, so they can change without a deploy. Cached for a
 * minute per server instance; a DB error falls back to the defaults rather
 * than blocking rewards.
 */
export async function loadRewardsConfig(admin: SupabaseAdmin): Promise<RewardsConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  const { data, error } = await admin.from("reward_config").select("config").eq("id", "default").maybeSingle();
  if (error) {
    console.error("[rewards] config load failed, using defaults", error);
    return DEFAULT_REWARDS_CONFIG;
  }
  const config = resolveRewardsConfig(data?.config);
  cached = { config, at: Date.now() };
  return config;
}

/** Drops this instance's cached copy — called after an admin saves new settings. */
export function invalidateRewardsConfigCache() {
  cached = null;
}
