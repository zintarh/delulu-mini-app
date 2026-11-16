import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { DEFAULT_FAUCET_CONFIG, resolveFaucetConfig, type FaucetConfig } from "@/lib/faucet/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const CACHE_MS = 30_000;
let cached: { config: FaucetConfig; at: number } | null = null;

/**
 * Code defaults overlaid with the faucet_config row. Cached 30s per instance.
 * A DB error falls back to the defaults (which are conservative), never to
 * "no limits".
 */
export async function loadFaucetConfig(admin: SupabaseAdmin): Promise<FaucetConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  const { data, error } = await admin.from("faucet_config").select("config").eq("id", "default").maybeSingle();
  if (error) {
    console.error("[faucet] config load failed, using defaults", error);
    return DEFAULT_FAUCET_CONFIG;
  }
  const config = resolveFaucetConfig(data?.config);
  cached = { config, at: Date.now() };
  return config;
}

export function invalidateFaucetConfigCache() {
  cached = null;
}
