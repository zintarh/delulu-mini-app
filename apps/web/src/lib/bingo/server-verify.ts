import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { keeperAddress, resolveCommitmentSuccessAsKeeper } from "@/lib/celo/forfeit-keeper";
import { readCommitment, readPeriodOutcome } from "@/lib/bingo/rolling";
import { recountAttempt } from "@/lib/bingo/attempts";
import { parsePeriodResolvedSuccessFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { evaluateAndCreditReferral } from "@/lib/referral/evaluate";
import { processVerifiedProof } from "@/lib/rewards/engine";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Whether this card names Delulu's server as verifier (new cards since 20 Nov 2026). */
export async function isServerVerified(onChainId: number): Promise<boolean> {
  const keeper = keeperAddress();
  if (!keeper) return false;
  const c = await readCommitment(onChainId);
  return c.verifier === keeper;
}

/**
 * Finishes an AI-approved day on a server-verified card: Delulu's verifier
 * wallet marks the period done on-chain, then the square is filled, the goal
 * updated and the photo's reward run — the same bookkeeping confirm-proof and
 * bingo confirm do for player-signed cards. Idempotent: a day already done
 * on-chain is just recorded.
 */
export async function finishDayAsVerifier(
  admin: Admin,
  params: { attemptId: string; squareIndex: number; rewardBudgetMs?: number },
): Promise<{ filled: true; resolveTx: string | null; ended: boolean }> {
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

  // Done on-chain already (a retry after a timeout): just record it.
  let resolveTx: `0x${string}` | null = null;
  let ended = false;
  if ((await readPeriodOutcome(onChainId, slot)) !== 1) {
    resolveTx = await resolveCommitmentSuccessAsKeeper(BigInt(onChainId));
    const ev = await parsePeriodResolvedSuccessFromTx(resolveTx);
    ended = !!ev?.commitmentEnded;
  }

  const { data: goal } = await admin.from("forfeit_commitments").select("id").eq("on_chain_commitment_id", onChainId).maybeSingle();
  if (goal) {
    await admin.from("forfeit_periods").upsert(
      {
        commitment_id: goal.id,
        period_index: slot,
        proof_url: sq.proof_url,
        ...(resolveTx ? { tx_hash: resolveTx } : {}),
        verifier_action: "approved",
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "commitment_id,period_index" },
    );
    if (ended) await admin.from("forfeit_commitments").update({ status: "completed" }).eq("id", goal.id);
  }

  await admin
    .from("bingo_squares")
    .update({ status: "filled", proof_tx: resolveTx, filled_at: new Date().toISOString() })
    .eq("id", sq.id)
    .eq("status", "confirming");
  await recountAttempt(admin, a.id);

  void evaluateAndCreditReferral(admin, String(a.wallet)).catch((err) => console.error("[bingo/server-verify] referral check failed", err));
  if (resolveTx) {
    // The photo's G$ reward — keyed on our resolve tx (see resolveVerifiedProof). Slower payouts settle in the payouts cron.
    await processVerifiedProof(admin, { kind: "forfeit", proofTxHash: resolveTx }, { budgetMs: params.rewardBudgetMs ?? 15_000 }).catch((err) =>
      console.error("[bingo/server-verify] reward failed", err),
    );
  }
  return { filled: true, resolveTx, ended };
}

/**
 * Backstop for the 5-minute keeper cron: any approved photo on a
 * server-verified card that isn't finished yet (e.g. the request timed out)
 * gets finished — before the deadline check can forfeit that day.
 */
export async function sweepUnfinishedDays(admin: Admin, maxCards = 20): Promise<{ checked: number; finished: number; failed: number }> {
  const out = { checked: 0, finished: 0, failed: 0 };
  const { data: rows } = await admin
    .from("bingo_squares")
    .select("attempt_id, square_index, approved_at, bingo_attempts!inner(forfeit_commitment_id, status)")
    .eq("status", "confirming")
    .eq("bonus", false)
    // Grace for the player to sign their own proof first (their on-chain activity); the client finishes the day right after.
    .lt("approved_at", new Date(Date.now() - 3 * 60_000).toISOString())
    .limit(maxCards);
  for (const r of rows ?? []) {
    const att = (Array.isArray(r.bingo_attempts) ? r.bingo_attempts[0] : r.bingo_attempts) as { forfeit_commitment_id: number | null; status: string } | null;
    if (!att?.forfeit_commitment_id || att.status !== "active") continue;
    out.checked++;
    try {
      if (!(await isServerVerified(Number(att.forfeit_commitment_id)))) continue; // older cards: the player signs
      await finishDayAsVerifier(admin, { attemptId: String(r.attempt_id), squareIndex: Number(r.square_index), rewardBudgetMs: 10_000 });
      out.finished++;
    } catch (err) {
      out.failed++;
      console.error("[bingo/server-verify] sweep failed", r.attempt_id, err);
    }
  }
  return out;
}
