import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { keeperAddress } from "@/lib/celo/forfeit-keeper";
import { readCommitment, readPeriodOutcome } from "@/lib/bingo/rolling";
import { recountAttempt } from "@/lib/bingo/attempts";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Whether this card names Delulu's server as verifier (new cards since 20 Nov 2026). */
export async function isServerVerified(onChainId: number): Promise<boolean> {
  const keeper = keeperAddress();
  if (!keeper) return false;
  const c = await readCommitment(onChainId);
  return c.verifier === keeper;
}

/**
 * Records an AI-approved day that the player has already marked successful
 * on-chain. Does not send a transaction: a day still pending is theirs to sign.
 */
export async function finishDayAsVerifier(
  admin: Admin,
  params: { attemptId: string; squareIndex: number; rewardBudgetMs?: number },
): Promise<{ filled: true; resolveTx: null; ended: false } | { filled: false; needsPlayer: true }> {
  const { data: a } = await admin
    .from("bingo_attempts")
    .select("id, wallet, forfeit_commitment_id")
    .eq("id", params.attemptId)
    .single();
  if (!a?.forfeit_commitment_id) throw new Error("This card isn't on-chain yet.");
  const onChainId = Number(a.forfeit_commitment_id);
  const { data: sq } = await admin
    .from("bingo_squares")
    .select("id, status, slot_index, proof_url")
    .eq("attempt_id", a.id)
    .eq("square_index", params.squareIndex)
    .single();
  if (!sq) throw new Error("No approved photo for this square.");
  if (sq.status === "filled") return { filled: true, resolveTx: null, ended: false };
  const slot = Number(sq.slot_index);

  // The player signs the success. This only records a day they already signed.
  if ((await readPeriodOutcome(onChainId, slot)) !== 1) {
    return { filled: false, needsPlayer: true };
  }

  const { data: goal } = await admin.from("forfeit_commitments").select("id").eq("on_chain_commitment_id", onChainId).maybeSingle();
  if (goal) {
    await admin.from("forfeit_periods").upsert(
      {
        commitment_id: goal.id,
        period_index: slot,
        proof_url: sq.proof_url,
        verifier_action: "approved",
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "commitment_id,period_index" },
    );
  }

  await admin
    .from("bingo_squares")
    .update({ status: "filled", filled_at: new Date().toISOString() })
    .eq("id", sq.id)
    .eq("status", "confirming");
  await recountAttempt(admin, a.id);

  void evaluateAndCreditReferral(admin, String(a.wallet)).catch((err) => console.error("[bingo/server-verify] referral check failed", err));
  return { filled: true, resolveTx: null, ended: false };
}

/**
 * Backstop for a save that timed out after the player already signed the day.
 * A day they have not signed stays pending.
 */
export async function sweepUnfinishedDays(admin: Admin, maxCards = 20): Promise<{ checked: number; finished: number; failed: number }> {
  const out = { checked: 0, finished: 0, failed: 0 };
  const { data: rows } = await admin
    .from("bingo_squares")
    .select("attempt_id, square_index, approved_at, bingo_attempts!inner(forfeit_commitment_id, status)")
    .eq("status", "confirming")
    .eq("bonus", false)
    // A player who already signed, whose save timed out. Pending days stay pending.
    .limit(maxCards);
  for (const r of rows ?? []) {
    const att = (Array.isArray(r.bingo_attempts) ? r.bingo_attempts[0] : r.bingo_attempts) as { forfeit_commitment_id: number | null; status: string } | null;
    if (!att?.forfeit_commitment_id || att.status !== "active") continue;
    out.checked++;
    try {
      const result = await finishDayAsVerifier(admin, { attemptId: String(r.attempt_id), squareIndex: Number(r.square_index), rewardBudgetMs: 10_000 });
      if (result.filled) out.finished++;
    } catch (err) {
      out.failed++;
      console.error("[bingo/server-verify] sweep failed", r.attempt_id, err);
    }
  }
  return out;
}
