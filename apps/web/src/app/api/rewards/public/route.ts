import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { isCategoryEnabled, type CompletionTier, type RewardCategory } from "@/lib/rewards/rules";
import { aggregatePayouts, type PayoutRecord, type PublicRewardStats } from "@/lib/rewards/public-stats";
import { BASE_PROOF_POINTS, REDUCED_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";

export const dynamic = "force-dynamic";

export type PublicRewardsDto = {
  config: {
    dailyAmount: number;
    maxEligibleGoals: number;
    weeklyAmount: number;
    weeklyMinProofs: number;
    campaignTiers: CompletionTier[];
    goalTiers: CompletionTier[];
    categoryEnabled: Record<RewardCategory, boolean>;
    proofPoints: { staked: number; free: number };
  };
  /** Null if the payout records couldn't be read — the page hides the numbers rather than show zeros. */
  stats: (PublicRewardStats & { asOf: string }) | null;
};

const STATS_TTL_MS = 10 * 60_000;
let statsCache: { value: PublicRewardsDto["stats"]; at: number } | null = null;

async function loadStats(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<PublicRewardsDto["stats"]> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.value;
  const LIMIT = 50_000;
  const [grants, referrals, engine, legacy] = await Promise.all([
    admin.from("admin_reward_grants").select("recipient_address, amount, token_symbol, tx_hash").not("tx_hash", "is", null).limit(LIMIT),
    admin.from("referral_credits").select("referrer_wallet, gdollars_amount").eq("payout_status", "sent").limit(LIMIT),
    admin.from("reward_payouts").select("wallet, amount").eq("status", "confirmed").limit(LIMIT),
    admin.from("proof_rewards").select("wallet, amount").eq("status", "sent").limit(LIMIT),
  ]);
  // Grants and referrals are the bulk of it; without them the numbers would undersell, so skip them entirely.
  if (grants.error || referrals.error) {
    console.error("[rewards/public] stats unavailable", grants.error ?? referrals.error);
    return null;
  }
  const records: PayoutRecord[] = [
    ...(grants.data ?? [])
      .filter((g) => g.token_symbol === "G$" || g.token_symbol === "USDT")
      .map((g) => ({ wallet: String(g.recipient_address), amount: Number(g.amount), token: g.token_symbol as "G$" | "USDT" })),
    ...(referrals.data ?? []).map((r) => ({ wallet: String(r.referrer_wallet), amount: Number(r.gdollars_amount ?? 0), token: "G$" as const })),
    ...(engine.data ?? []).map((r) => ({ wallet: String(r.wallet), amount: Number(r.amount), token: "G$" as const })),
    ...(legacy.data ?? []).map((r) => ({ wallet: String(r.wallet), amount: Number(r.amount), token: "G$" as const })),
  ];
  const value = { ...aggregatePayouts(records), asOf: new Date().toISOString() };
  statsCache = { value, at: Date.now() };
  return value;
}

/**
 * GET /api/rewards/public — everything the public How to earn page shows:
 * reward amounts from the live config, and aggregate payout numbers (no
 * wallets, no per-person data). No sign-in needed.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  try {
    const [config, stats] = await Promise.all([loadRewardsConfig(admin), loadStats(admin).catch(() => null)]);
    const body: PublicRewardsDto = {
      config: {
        dailyAmount: config.dailyProof.amount,
        maxEligibleGoals: config.dailyProof.maxEligibleGoals,
        weeklyAmount: config.weeklyConsistency.amount,
        weeklyMinProofs: config.weeklyConsistency.minProofs,
        campaignTiers: config.campaignCompletion.tiers,
        goalTiers: config.goalCompletion.tiers,
        categoryEnabled: {
          daily_proof: isCategoryEnabled(config, "daily_proof"),
          weekly_consistency: isCategoryEnabled(config, "weekly_consistency"),
          campaign_completion: isCategoryEnabled(config, "campaign_completion"),
          goal_completion: isCategoryEnabled(config, "goal_completion"),
        },
        proofPoints: { staked: BASE_PROOF_POINTS, free: REDUCED_PROOF_POINTS },
      },
      stats,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    console.error("[rewards/public] failed", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
