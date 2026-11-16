import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { addDays, dayRunEndingAt, rewardDayFor } from "@/lib/rewards/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Streaks longer than this show as this many days (leaderboard display only). */
const LOOKBACK_DAYS = 120;

/**
 * Live day streaks (days in a row with a daily-rewarded proof, ending today
 * or yesterday) for a handful of wallets — the leaderboard flame. Same days
 * the streak milestones pay on, so extra goals or self-verified proofs never
 * move it. Wallets without a streak are left out. Never throws: the flame is
 * decoration, a failed lookup just shows no flames.
 */
export async function fetchLiveStreaks(admin: SupabaseAdmin, wallets: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(wallets.map((w) => w.toLowerCase()))];
  if (ids.length === 0) return {};
  try {
    const config = await loadRewardsConfig(admin);
    const today = rewardDayFor(new Date(), config.timezone);
    const { data, error } = await admin
      .from("reward_payouts")
      .select("wallet, reward_day")
      .eq("category", "daily_proof")
      .in("wallet", ids)
      .gte("reward_day", addDays(today, -LOOKBACK_DAYS))
      .limit(10_000);
    if (error) throw new Error(error.message);
    const byWallet = new Map<string, string[]>();
    for (const r of data ?? []) {
      const w = (r.wallet as string).toLowerCase();
      byWallet.set(w, [...(byWallet.get(w) ?? []), r.reward_day as string]);
    }
    const out: Record<string, number> = {};
    for (const [w, days] of byWallet) {
      const run = dayRunEndingAt(days, today, true).length;
      if (run > 0) out[w] = run;
    }
    return out;
  } catch (err) {
    console.error("[leaderboard] streak lookup failed", err);
    return {};
  }
}
