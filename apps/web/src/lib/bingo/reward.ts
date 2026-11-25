import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { rollingAttemptOver, type BingoAttemptRow, type BingoTier } from "@/lib/bingo/types";
import { BOOST, boostSummary } from "@/lib/bingo/boost";
import { loadBoosts } from "@/lib/bingo/boost-server";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * The per-photo G$ a Bingo tier sets for its daily squares (e.g. Delulu
 * Debut: 100), or null when the goal isn't a Bingo card or the tier uses the global
 * daily amount. goalRef: community_campaigns.id (weekly tier) or
 * forfeit_commitments.id (rolling card).
 */
export async function bingoRewardPerSquare(admin: Admin, goalKind: "campaign" | "forfeit", goalRef: string): Promise<number | null> {
  const tier = await bingoTierFor(admin, goalKind, goalRef);
  return typeof tier?.rewardPerSquare === "number" ? tier.rewardPerSquare : null;
}

/**
 * G$ for finishing a Bingo card: with Daily Boost live, a daily card's cashback
 * is a share of its whole pot (lib/bingo/boost.ts); otherwise the tier's own
 * amount (e.g. 7-day Pro: 1,200), or null → engine default.
 */
export async function bingoCompletionReward(admin: Admin, goalKind: "campaign" | "forfeit", goalRef: string): Promise<number | null> {
  if (BOOST.live && goalKind === "forfeit") {
    const boosted = await boostCashbackForGoal(admin, goalRef).catch(() => null);
    if (boosted != null) return boosted;
  }
  const tier = await bingoTierFor(admin, goalKind, goalRef);
  if (tier?.potShare && goalKind === "forfeit") return (await potShareForGoal(admin, goalRef).catch(() => null)) ?? 0;
  return typeof tier?.completionReward === "number" ? tier.completionReward : null;
}

/** The Bingo tier (as frozen in the card's version) behind a goal, or null when it isn't a Bingo card. */
async function bingoTierFor(admin: Admin, goalKind: "campaign" | "forfeit", goalRef: string): Promise<BingoTier | null> {
  let versionId: string | null = null;
  let tierKey: string | null = null;
  if (goalKind === "campaign") {
    const { data } = await admin
      .from("bingo_cycle_tiers")
      .select("tier_key, bingo_cycles!inner(version_id)")
      .eq("community_campaign_id", goalRef)
      .maybeSingle();
    if (!data) return null;
    const cycle = (Array.isArray(data.bingo_cycles) ? data.bingo_cycles[0] : data.bingo_cycles) as { version_id: string };
    versionId = cycle.version_id;
    tierKey = data.tier_key as string;
  } else {
    const { data: goal } = await admin.from("forfeit_commitments").select("on_chain_commitment_id").eq("id", goalRef).maybeSingle();
    if (goal?.on_chain_commitment_id == null) return null;
    const { data } = await admin
      .from("bingo_attempts")
      .select("version_id, tier_key")
      .eq("forfeit_commitment_id", goal.on_chain_commitment_id)
      .maybeSingle();
    if (!data) return null;
    versionId = data.version_id as string;
    tierKey = data.tier_key as string;
  }
  const { data: version } = await admin.from("bingo_versions").select("tiers").eq("id", versionId).maybeSingle();
  return ((version?.tiers ?? []) as BingoTier[]).find((t) => t.key === tierKey) ?? null;
}

/** What a card shows per daily square: the tier's own amount if it sets one, else the global one. */
export function perSquareFor(tiers: Pick<BingoTier, "key" | "rewardPerSquare">[], tierKey: string | null, globalAmount: number): number {
  const own = tierKey ? tiers.find((t) => t.key === tierKey)?.rewardPerSquare : undefined;
  if (typeof own === "number") return own;
  // Not playing yet: if every tier agrees on an override, show it.
  const set = new Set(tiers.map((t) => (typeof t.rewardPerSquare === "number" ? t.rewardPerSquare : globalAmount)));
  return set.size === 1 ? [...set][0] : globalAmount;
}

/** Daily Boost cashback for a finished daily Bingo card (forfeit_commitments.id), or null when it isn't one. */
async function boostCashbackForGoal(admin: Admin, goalRef: string): Promise<number | null> {
  const { data: goal } = await admin.from("forfeit_commitments").select("on_chain_commitment_id").eq("id", goalRef).maybeSingle();
  if (goal?.on_chain_commitment_id == null) return null;
  const { data: attempt } = await admin
    .from("bingo_attempts")
    .select("id, stake_amount, bingo_campaigns!inner(duration_days)")
    .eq("forfeit_commitment_id", goal.on_chain_commitment_id)
    .maybeSingle();
  if (!attempt || !(Number(attempt.stake_amount) > 0)) return null;
  const camp = (Array.isArray(attempt.bingo_campaigns) ? attempt.bingo_campaigns[0] : attempt.bingo_campaigns) as { duration_days: number };
  const [boosts, { data: squares }] = await Promise.all([
    loadBoosts(admin, String(attempt.id)),
    admin.from("bingo_squares").select("square_index").eq("attempt_id", attempt.id).eq("status", "filled"),
  ]);
  return boostSummary({
    startStake: Number(attempt.stake_amount),
    boosts,
    keptSlots: (squares ?? []).map((q) => Number(q.square_index)),
    days: camp.duration_days,
  }).cashback;
}

/** Share of missed stakes that goes to finishers (the rest is Delulu's, as on-chain: lib/celo/pot-sweep). */
export const POT_FINISHERS_SHARE = 0.8;

/**
 * "Finishers split the pot" (First Week, 25 Nov 2026): a finished card on a
 * potShare tier earns from the stakes of players on the same Bingo's potShare
 * versions who missed — 80% of what they lost, minus what earlier finishers
 * already took — up to its own stake (so at most double your money). Nothing
 * comes from grants: no misses, no share.
 */
async function potShareForGoal(admin: Admin, goalRef: string): Promise<number | null> {
  const { data: goal } = await admin.from("forfeit_commitments").select("on_chain_commitment_id").eq("id", goalRef).maybeSingle();
  if (goal?.on_chain_commitment_id == null) return null;
  const { data: mine } = await admin
    .from("bingo_attempts")
    .select("id, campaign_id, stake_amount")
    .eq("forfeit_commitment_id", goal.on_chain_commitment_id)
    .maybeSingle();
  if (!mine) return null;

  // Every version of this Bingo that splits the pot, and every card on them.
  const { data: versions } = await admin.from("bingo_versions").select("id, tiers").eq("campaign_id", mine.campaign_id);
  const potVersions = (versions ?? []).filter((v) => ((v.tiers ?? []) as BingoTier[]).some((t) => t.potShare)).map((v) => String(v.id));
  if (!potVersions.length) return null;
  const { data: cards } = await admin
    .from("bingo_attempts")
    .select("*, bingo_campaigns!inner(duration_days)")
    .in("version_id", potVersions)
    .limit(20_000);
  const all = (cards ?? []) as (BingoAttemptRow & { bingo_campaigns: { duration_days: number } | { duration_days: number }[] })[];
  const days = (c: (typeof all)[number]) => (Array.isArray(c.bingo_campaigns) ? c.bingo_campaigns[0] : c.bingo_campaigns).duration_days;
  const missed = all.filter((c) => c.required_filled < days(c) && rollingAttemptOver(c, days(c)));
  const lost = missed.reduce((n, c) => n + Number(c.stake_amount), 0);

  // What earlier finishers already took (their finishing rewards).
  // Batched: thousands of cards would overflow one IN (...) list.
  const ids = all.map((c) => c.forfeit_commitment_id).filter((x): x is number => x != null);
  const refs: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: goals } = await admin.from("forfeit_commitments").select("id").in("on_chain_commitment_id", ids.slice(i, i + 200));
    refs.push(...(goals ?? []).map((g) => String(g.id)).filter((id) => id !== goalRef));
  }
  let taken = 0;
  for (let i = 0; i < refs.length; i += 200) {
    const { data: paid } = await admin
      .from("reward_payouts")
      .select("amount")
      .eq("category", "goal_completion")
      .in("goal_ref", refs.slice(i, i + 200))
      .neq("status", "failed");
    taken += (paid ?? []).reduce((n, p) => n + Number(p.amount), 0);
  }

  const available = Math.max(0, Math.floor(lost * POT_FINISHERS_SHARE - taken));
  return Math.min(Number(mine.stake_amount), available);
}
