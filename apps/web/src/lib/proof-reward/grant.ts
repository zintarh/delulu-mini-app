import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { getPoolAvailableWhole, payoutProofReward } from "@/lib/celo/reward-vault-payout";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type ProofRewardKind = "campaign" | "forfeit";

/**
 * Records that a proof passed off-chain review (AI verdict, or a friend's
 * approval), so a later on-chain submission carrying this exact proof URL
 * counts as a verified event for the Rewards Engine (lib/rewards/engine.ts).
 * Never overwrites an existing row, so re-reviewing a URL can't reset it.
 */
export async function recordApprovedProof(
  admin: SupabaseAdmin,
  params: { wallet: string; kind: ProofRewardKind; proofUrl: string; refId: string | number },
): Promise<void> {
  const { error } = await admin.from("proof_rewards").upsert(
    {
      wallet: params.wallet.toLowerCase(),
      kind: params.kind,
      proof_url: params.proofUrl,
      ref_id: String(params.refId),
    },
    { onConflict: "wallet,proof_url", ignoreDuplicates: true },
  );
  if (error) console.error("[proof-reward] failed to record approved proof", error);
}

/**
 * Finishes the retired 10 G$ per-proof reward for rows that failed before
 * the Rewards Engine replaced it (they had already reserved their slot, so
 * the user is owed them). Pays the row's own amount under its original
 * rewardId — usedRewardId makes a repeat a no-op. Nothing new ever becomes
 * 'failed' here, so this drains to zero and can then be removed.
 */
export async function retryLegacyFailedProofRewards(
  admin: SupabaseAdmin,
  limit = 10,
): Promise<{ found: number; retried: number; stillFailed: number; poolEmpty: boolean }> {
  const { data: rows, error } = await admin
    .from("proof_rewards")
    .select("id, wallet, amount, proof_tx_hash")
    .eq("status", "failed")
    .not("proof_tx_hash", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`[proof-reward] failed-row lookup: ${error.message}`);
  const found = rows?.length ?? 0;
  if (found === 0) return { found, retried: 0, stillFailed: 0, poolEmpty: false };

  let budget = await getPoolAvailableWhole();
  let retried = 0;
  for (const row of rows ?? []) {
    const amount = Number(row.amount);
    if (amount > budget) break;
    try {
      const result = await payoutProofReward({
        wallet: row.wallet as `0x${string}`,
        proofTxHash: row.proof_tx_hash as `0x${string}`,
        amountWhole: amount,
      });
      await admin
        .from("proof_rewards")
        .update({
          status: "sent",
          reward_id: result.rewardId,
          deposit_tx_hash: result.txHash,
          paid_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      budget -= amount;
      retried++;
    } catch (err) {
      console.error(`[proof-reward] legacy retry failed for ${row.proof_tx_hash}:`, err);
    }
  }
  return { found, retried, stillFailed: found - retried, poolEmpty: retried < found && budget <= 0 };
}
