import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { celo } from "viem/chains";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import { DELULU_CHAIN_ID, getForfeitMarketAddress } from "@/lib/constant";
import { fetchJoinedCampaignDashboard } from "@/lib/community/joined-dashboard";
import { loadRewardsConfig } from "@/lib/rewards/config";
import { isCategoryEnabled, rewardDayFor, type CompletionTier, type GoalKind, type RewardCategory } from "@/lib/rewards/rules";
import {
  computeCampaignProgress,
  computeGoalProgress,
  computeTotals,
  computeWeeklyProgress,
  displayStatus,
  type CompletionProgress,
  type HistoryInput,
  type HistoryItem,
  type RewardTotals,
  type WeeklyProgress,
} from "@/lib/rewards/summary";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 100;

export type RewardsSummaryDto = {
  config: {
    enabled: boolean;
    dailyAmount: number;
    maxEligibleGoals: number;
    weeklyAmount: number;
    weeklyMinProofs: number;
    campaignTiers: CompletionTier[];
    goalTiers: CompletionTier[];
    /** Per-category switches (already folded with the master switch). */
    categoryEnabled: Record<RewardCategory, boolean>;
  };
  totals: RewardTotals;
  daily: {
    today: string;
    earnedToday: number;
    /** Goals currently holding an earning slot. */
    goals: { kind: GoalKind; ref: string; title: string | null }[];
    /** Slots blocked after a goal was abandoned. */
    coolingUntil: string[];
  };
  weekly: WeeklyProgress;
  completions: CompletionProgress[];
  history: HistoryItem[];
  /** Sections whose live data couldn't be loaded (shown as unavailable, never as zero progress). */
  unavailable: ("completions" | "goals")[];
};

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

/**
 * Everything the Rewards page shows about the G$ Rewards Engine, for the
 * signed-in wallet: totals (confirmed only count as earned), per-category
 * progress computed by the same rules the engine pays by, and history.
 * GET /api/rewards/summary?address=0x…
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!isAddress(raw)) return NextResponse.json({ error: "Valid address is required" }, { status: 400 });
  const wallet = getAddress(raw).toLowerCase();
  try {
    requireAuthenticatedWallet(request, wallet);
  } catch (err) {
    return walletAuthErrorResponse(err);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  try {
    const config = await loadRewardsConfig(admin);
    const today = rewardDayFor(new Date(), config.timezone);
    const unavailable: RewardsSummaryDto["unavailable"] = [];

    const [payoutsRes, legacyRes, slotsRes, joined] = await Promise.all([
      admin
        .from("reward_payouts")
        .select("id, category, amount, status, tx_hash, goal_kind, goal_ref, period_key, reward_day, created_at, confirmed_at")
        .eq("wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("proof_rewards")
        .select("id, kind, ref_id, amount, status, deposit_tx_hash, reward_day, created_at, paid_at")
        .eq("wallet", wallet)
        .in("status", ["sent", "paying", "failed"])
        .limit(2000),
      admin
        .from("reward_goal_slots")
        .select("goal_kind, goal_ref, released_at, cooldown_until")
        .eq("wallet", wallet),
      fetchJoinedCampaignDashboard(admin, wallet, { withAvatars: false }).catch((err) => {
        console.error("[rewards/summary] joined campaigns failed", err);
        unavailable.push("completions");
        return null;
      }),
    ]);
    if (payoutsRes.error) throw new Error(payoutsRes.error.message);
    if (legacyRes.error) throw new Error(legacyRes.error.message);
    if (slotsRes.error) throw new Error(slotsRes.error.message);

    const inputs: HistoryInput[] = [
      ...(payoutsRes.data ?? []).map((r) => ({
        id: r.id as string,
        category: r.category as RewardCategory,
        amount: Number(r.amount),
        status: r.status as string,
        txHash: (r.tx_hash as string | null) ?? null,
        goalKind: (r.goal_kind as GoalKind | null) ?? null,
        goalRef: (r.goal_ref as string | null) ?? null,
        periodKey: (r.period_key as string | null) ?? null,
        rewardDay: (r.reward_day as string | null) ?? null,
        createdAt: r.created_at as string,
        confirmedAt: (r.confirmed_at as string | null) ?? null,
        legacy: false,
      })),
      // The retired 10 G$ per-proof reward — real earnings, so they count.
      ...(legacyRes.data ?? []).map((r) => ({
        id: `legacy-${r.id}`,
        category: "daily_proof" as const,
        amount: Number(r.amount),
        status: r.status as string,
        txHash: (r.deposit_tx_hash as string | null) ?? null,
        goalKind: r.kind as GoalKind,
        goalRef: (r.ref_id as string | null) ?? null,
        periodKey: (r.reward_day as string | null) ?? null,
        rewardDay: (r.reward_day as string | null) ?? null,
        createdAt: (r.paid_at as string | null) ?? (r.created_at as string),
        confirmedAt: (r.paid_at as string | null) ?? null,
        legacy: true,
      })),
    ];

    const slots = slotsRes.data ?? [];
    const heldSlots = slots.filter((s) => !s.released_at);

    // Titles for every goal/campaign referenced.
    const forfeitIds = new Set<string>();
    const campaignIds = new Set<string>();
    for (const i of inputs) {
      if (i.goalRef && i.goalKind === "forfeit") forfeitIds.add(i.goalRef);
      if (i.goalRef && i.goalKind === "campaign") campaignIds.add(i.goalRef);
    }
    for (const s of slots) (s.goal_kind === "forfeit" ? forfeitIds : campaignIds).add(s.goal_ref as string);
    const [forfeitRes, campaignRes] = await Promise.all([
      forfeitIds.size
        ? admin
            .from("forfeit_commitments")
            .select("id, title, status, on_chain_commitment_id")
            .in("id", [...forfeitIds])
        : Promise.resolve({ data: [] as { id: string; title: string; status: string; on_chain_commitment_id: number | null }[] }),
      campaignIds.size
        ? admin.from("community_campaigns").select("id, title").in("id", [...campaignIds])
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const forfeits = new Map((forfeitRes.data ?? []).map((f) => [f.id as string, f]));
    const titles = new Map<string, string>();
    for (const f of forfeitRes.data ?? []) titles.set(`forfeit:${f.id}`, f.title as string);
    for (const c of campaignRes.data ?? []) titles.set(`campaign:${c.id}`, c.title as string);
    const titleFor = (kind: GoalKind | null, ref: string | null) => (kind && ref ? titles.get(`${kind}:${ref}`) ?? null : null);

    const items: HistoryItem[] = [];
    for (const i of inputs) {
      const status = displayStatus(i.status, i.legacy);
      if (!status) continue;
      items.push({ ...i, status, goalTitle: titleFor(i.goalKind, i.goalRef) });
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const engineDaily = items.filter((i) => i.category === "daily_proof" && !i.legacy);
    const weekly = computeWeeklyProgress({
      today,
      engineDailyDays: engineDaily.map((i) => i.rewardDay!).filter(Boolean),
      weeklyRewards: items.filter((i) => i.category === "weekly_consistency"),
      config,
    });

    const campaignProgress = joined
      ? computeCampaignProgress({
          config,
          completionRewards: items.filter((i) => i.category === "campaign_completion"),
          campaigns: joined.map((c) => ({
            campaignId: c.campaign_id,
            title: c.title,
            durationDays: Number(c.duration_days),
            challengeId: Number(c.challenge_id) || 0,
            milestoneCount: Number(c.milestone_count) || 0,
            completedCount: Number(c.completed_count) || 0,
            overdueCount: Number((c as { overdue_count?: number }).overdue_count ?? c.missed_count) || 0,
            missedCount: Number(c.missed_count) || 0,
          })),
        })
      : [];

    // Forfeit goals in an earning slot: periods come from the contract.
    const slottedGoals = heldSlots
      .filter((s) => s.goal_kind === "forfeit")
      .map((s) => forfeits.get(s.goal_ref as string))
      .filter((f): f is NonNullable<typeof f> => !!f && f.status === "active" && f.on_chain_commitment_id != null);
    let goalProgress: CompletionProgress[] = [];
    if (slottedGoals.length > 0) {
      try {
        const market = getForfeitMarketAddress(DELULU_CHAIN_ID);
        const onChain = await Promise.all(
          slottedGoals.map(
            (f) =>
              publicClient.readContract({
                address: market,
                abi: FORFEIT_MARKET_ABI,
                functionName: "commitments",
                args: [BigInt(f.on_chain_commitment_id!)],
              }) as Promise<readonly unknown[]>,
          ),
        );
        goalProgress = computeGoalProgress({
          config,
          completionRewards: items.filter((i) => i.category === "goal_completion"),
          goals: slottedGoals.map((f, idx) => ({
            commitmentId: f.id as string,
            title: f.title as string,
            periodSeconds: Number(onChain[idx][6] as bigint),
            periodsResolved: Number(onChain[idx][8]),
            totalPeriods: Number(onChain[idx][9]),
            // Same count the engine uses: confirmed-or-not engine rows + paid legacy rows.
            rewardedProofs: items.filter(
              (i) =>
                i.category === "daily_proof" &&
                i.goalKind === "forfeit" &&
                i.goalRef === f.id &&
                (!i.legacy || i.status === "confirmed"),
            ).length,
          })),
        });
      } catch (err) {
        console.error("[rewards/summary] goal progress failed", err);
        unavailable.push("goals");
      }
    }

    const body: RewardsSummaryDto = {
      config: {
        enabled: config.enabled,
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
      },
      totals: computeTotals(items),
      daily: {
        today,
        earnedToday: engineDaily.filter((i) => i.rewardDay === today).length,
        goals: heldSlots.map((s) => ({
          kind: s.goal_kind as GoalKind,
          ref: s.goal_ref as string,
          title: titleFor(s.goal_kind as GoalKind, s.goal_ref as string),
        })),
        coolingUntil: slots
          .filter((s) => s.released_at && s.cooldown_until && (s.cooldown_until as string) > today)
          .map((s) => s.cooldown_until as string),
      },
      weekly,
      completions: [
        ...(isCategoryEnabled(config, "goal_completion") ? goalProgress : goalProgress.filter((p) => p.reward)),
        ...(isCategoryEnabled(config, "campaign_completion") ? campaignProgress : campaignProgress.filter((p) => p.reward)),
      ],
      history: items.slice(0, HISTORY_LIMIT),
      unavailable,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[rewards/summary] error:", err);
    return NextResponse.json({ error: "Failed to load rewards" }, { status: 500 });
  }
}
