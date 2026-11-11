import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { getRewarderStatus, type RewarderStatus } from "@/lib/celo/reward-vault-payout";
import { loadRewardsConfig } from "@/lib/rewards/config";
import type { RewardCategory } from "@/lib/rewards/rules";

export const dynamic = "force-dynamic";

type CategoryStats = { confirmed: number; confirmed_count: number; pending: number; failed: number };

export type RewardEngineOverviewDto = {
  stats: {
    confirmed_total: number;
    confirmed_count: number;
    recipients: number;
    confirmed_24h: number;
    confirmed_7d: number;
    confirmed_30d: number;
    pending_total: number;
    pending_count: number;
    failed_total: number;
    failed_count: number;
    oldest_open_at: string | null;
    sent_today_utc: number;
    legacy_sent_total: number;
    by_category: Partial<Record<RewardCategory, CategoryStats>>;
  };
  vault: (RewarderStatus & { error?: never }) | { error: string };
  /** Granted but not yet sent/confirmed — what the pool still has to cover. */
  openLiabilities: number;
  /** Days the unallocated pool lasts at the last 7 days' pace; null when nothing was paid. */
  runwayDays: number | null;
  dailyBudget: number;
  enabled: Record<RewardCategory | "engine", boolean>;
};

/** GET /api/dashboard/reward-engine/overview — distribution totals, open liabilities, vault health. */
export async function GET() {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  try {
    const [statsRes, vault, config] = await Promise.all([
      admin.rpc("reward_engine_stats"),
      getRewarderStatus().catch((err: unknown) => ({
        error: err instanceof Error ? err.message : "Couldn't read the vault",
      })),
      loadRewardsConfig(admin),
    ]);
    if (statsRes.error) throw new Error(statsRes.error.message);
    const raw = statsRes.data as Record<string, unknown>;
    const num = (k: string) => Number(raw[k] ?? 0);
    const stats: RewardEngineOverviewDto["stats"] = {
      confirmed_total: num("confirmed_total"),
      confirmed_count: num("confirmed_count"),
      recipients: num("recipients"),
      confirmed_24h: num("confirmed_24h"),
      confirmed_7d: num("confirmed_7d"),
      confirmed_30d: num("confirmed_30d"),
      pending_total: num("pending_total"),
      pending_count: num("pending_count"),
      failed_total: num("failed_total"),
      failed_count: num("failed_count"),
      oldest_open_at: (raw.oldest_open_at as string | null) ?? null,
      sent_today_utc: num("sent_today_utc"),
      legacy_sent_total: num("legacy_sent_total"),
      by_category: Object.fromEntries(
        Object.entries((raw.by_category ?? {}) as Record<string, Record<string, unknown>>).map(([k, v]) => [
          k,
          {
            confirmed: Number(v.confirmed ?? 0),
            confirmed_count: Number(v.confirmed_count ?? 0),
            pending: Number(v.pending ?? 0),
            failed: Number(v.failed ?? 0),
          },
        ]),
      ),
    };

    const perDay = stats.confirmed_7d / 7;
    const poolAvailable = "error" in vault ? null : Number(vault.poolAvailable);
    const body: RewardEngineOverviewDto = {
      stats,
      vault,
      openLiabilities: stats.pending_total + stats.failed_total,
      runwayDays: poolAvailable != null && perDay > 0 ? Math.floor(poolAvailable / perDay) : null,
      dailyBudget: config.limits.dailyBudget,
      enabled: {
        engine: config.enabled,
        daily_proof: config.dailyProof.enabled,
        weekly_consistency: config.weeklyConsistency.enabled,
        campaign_completion: config.campaignCompletion.enabled,
        goal_completion: config.goalCompletion.enabled,
      },
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[dashboard/reward-engine/overview] failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load overview" }, { status: 500 });
  }
}
