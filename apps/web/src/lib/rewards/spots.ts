import type { getSupabaseAdmin } from "@/lib/push/supabase";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Photo-reward spots: a player earns daily photo G$ on a few goals at a time
 * (rewards config `dailyProof.maxEligibleGoals`). Joining Bingos is never
 * limited — the spots only decide which cards pay per photo. Among running
 * Bingo cards the biggest stakes earn: a bigger card takes the spot of a
 * smaller one. Spots locked after a missed goal (cooldown) stay locked.
 * Cashback for finishing is paid on every card either way.
 */

/** Stake of the Bingo card behind a Forfeit goal (forfeit_commitments.id), or null if it isn't a Bingo card. */
export async function bingoStakeForGoal(admin: Admin, goalRef: string): Promise<number | null> {
  const { data: goal } = await admin.from("forfeit_commitments").select("on_chain_commitment_id").eq("id", goalRef).maybeSingle();
  if (goal?.on_chain_commitment_id == null) return null;
  const { data } = await admin
    .from("bingo_attempts")
    .select("stake_amount")
    .eq("forfeit_commitment_id", goal.on_chain_commitment_id)
    .maybeSingle();
  return data ? Number(data.stake_amount) : null;
}

type HeldSlot = { id: string; goalRef: string; bingoStake: number | null };

/** Spots in use: held by running goals (with their Bingo stake, if any) and locked by cooldowns. */
export async function loadSpots(admin: Admin, wallet: string, day: string): Promise<{ held: HeldSlot[]; cooling: number }> {
  const { data, error } = await admin
    .from("reward_goal_slots")
    .select("id, goal_kind, goal_ref, released_at, cooldown_until")
    .eq("wallet", wallet);
  if (error) throw new Error(`[spots] ${error.message}`);
  const rows = data ?? [];
  const heldRows = rows.filter((r) => r.released_at == null);
  const held = await Promise.all(
    heldRows.map(async (r) => ({
      id: String(r.id),
      goalRef: String(r.goal_ref),
      bingoStake: r.goal_kind === "forfeit" ? await bingoStakeForGoal(admin, String(r.goal_ref)) : null,
    })),
  );
  const cooling = rows.filter((r) => r.released_at != null && r.cooldown_until != null && String(r.cooldown_until) > day).length;
  return { held, cooling };
}

/** The held Bingo spot a card with this stake would take over: the smallest stake below it, if any. */
export function spotToTake(held: HeldSlot[], stake: number, exceptGoalRef?: string): HeldSlot | null {
  return (
    held
      .filter((s) => s.goalRef !== exceptGoalRef && s.bingoStake != null && s.bingoStake < stake)
      .sort((a, b) => a.bingoStake! - b.bingoStake!)[0] ?? null
  );
}

/**
 * Called when a Bingo photo found every spot taken: if a smaller running
 * Bingo card holds one, hand that spot to this card (the smaller card can
 * take a spot again later, when one frees up). Returns whether a spot was freed.
 */
export async function takeSpotFromSmallerBingo(admin: Admin, wallet: string, goalRef: string, day: string): Promise<boolean> {
  const stake = await bingoStakeForGoal(admin, goalRef);
  if (stake == null) return false;
  const { held } = await loadSpots(admin, wallet, day);
  const target = spotToTake(held, stake, goalRef);
  if (!target) return false;
  // Deleted, not released: a released slot can never earn again, and the smaller card did nothing wrong.
  const { error } = await admin.from("reward_goal_slots").delete().eq("id", target.id).is("released_at", null);
  if (error) throw new Error(`[spots] free: ${error.message}`);
  return true;
}
