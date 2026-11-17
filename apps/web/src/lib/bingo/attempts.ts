import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { logBingoEvent } from "@/lib/bingo/cycles";
import { isBonusTier, type BingoAttemptRow, type BingoCycleRow, type BingoCycleTierRow, type BingoSquareRow } from "@/lib/bingo/types";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** The Bingo tier behind a community campaign row, if it is one. */
export async function bingoTierForCampaign(
  admin: Admin,
  communityCampaignId: string,
): Promise<(BingoCycleTierRow & { cycle: BingoCycleRow }) | null> {
  const { data } = await admin
    .from("bingo_cycle_tiers")
    .select("*, cycle:bingo_cycles!inner(*)")
    .eq("community_campaign_id", communityCampaignId)
    .maybeSingle();
  return (data as (BingoCycleTierRow & { cycle: BingoCycleRow }) | null) ?? null;
}

/** One card per player per cycle: joining a second tier of the same cycle is blocked. */
export async function otherTierAttempt(admin: Admin, cycleId: string, wallet: string, tierId: string) {
  const { data } = await admin
    .from("bingo_attempts")
    .select("id, tier_key, cycle_tier_id")
    .eq("cycle_id", cycleId)
    .eq("wallet", wallet.toLowerCase())
    .maybeSingle();
  return data && data.cycle_tier_id !== tierId ? data : null;
}

/**
 * Called from the campaign confirm-join route once the join tx is verified:
 * opens this player's card for the cycle. Idempotent per (cycle, wallet).
 */
export async function openAttemptFromJoin(admin: Admin, communityCampaignId: string, wallet: string, joinTx: string) {
  const tier = await bingoTierForCampaign(admin, communityCampaignId);
  // Bonus campaigns ride on the player's existing card — never a card of their own.
  if (!tier || isBonusTier(tier.tier_key)) return null;
  const w = wallet.toLowerCase();
  const startedAt = new Date(Math.max(Date.now(), Date.parse(tier.cycle.starts_at))).toISOString();
  const { data, error } = await admin
    .from("bingo_attempts")
    .upsert(
      {
        campaign_id: tier.cycle.campaign_id,
        version_id: tier.cycle.version_id,
        cycle_id: tier.cycle.id,
        cycle_tier_id: tier.id,
        tier_key: tier.tier_key,
        wallet: w,
        stake_amount: tier.stake_amount,
        join_tx: joinTx.toLowerCase(),
        started_at: startedAt,
        ends_at: tier.cycle.ends_at,
      },
      { onConflict: "cycle_id,wallet", ignoreDuplicates: true },
    )
    .select("id");
  if (error) {
    await logBingoEvent(admin, { cycleId: tier.cycle.id, tierId: tier.id, kind: "attempt_open_failed", ok: false, detail: `${w}: ${error.message}` });
    throw new Error(error.message);
  }
  return data?.[0]?.id ?? null;
}

/** Counters on the attempt are derived from filled squares only. */
export async function recountAttempt(admin: Admin, attemptId: string) {
  const { data } = await admin
    .from("bingo_squares")
    .select("bonus, filled_at")
    .eq("attempt_id", attemptId)
    .eq("status", "filled");
  const rows = data ?? [];
  const last = rows.map((r) => r.filled_at as string).sort().at(-1) ?? null;
  await admin
    .from("bingo_attempts")
    .update({
      squares_filled: rows.length,
      required_filled: rows.filter((r) => !r.bonus).length,
      last_filled_at: last,
    })
    .eq("id", attemptId);
}

export async function loadAttempt(admin: Admin, attemptId: string) {
  const { data } = await admin
    .from("bingo_attempts")
    .select("*, tier:bingo_cycle_tiers(*), cycle:bingo_cycles(*)")
    .eq("id", attemptId)
    .maybeSingle();
  return data as (BingoAttemptRow & { tier: BingoCycleTierRow | null; cycle: BingoCycleRow | null }) | null;
}

export async function loadSquares(admin: Admin, attemptIds: string[]) {
  if (attemptIds.length === 0) return new Map<string, BingoSquareRow[]>();
  const { data } = await admin
    .from("bingo_squares")
    .select("id, attempt_id, square_index, mission_title, bonus, slot_index, proof_url, status, filled_at")
    .in("attempt_id", attemptIds);
  const map = new Map<string, BingoSquareRow[]>();
  for (const s of (data ?? []) as BingoSquareRow[]) {
    const list = map.get(s.attempt_id) ?? [];
    list.push(s);
    map.set(s.attempt_id, list);
  }
  return map;
}
