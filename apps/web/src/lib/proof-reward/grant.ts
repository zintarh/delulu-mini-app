import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { isGoodDollarVerified } from "@/lib/referral/verify-identity";
import { payoutProofReward, proofRewardRewardId } from "@/lib/celo/reward-vault-payout";
import { parseCommunityMilestoneProofSubmittedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { parseProofSubmittedFromTx } from "@/lib/dashboard/parse-forfeit-tx";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const PROOF_REWARD_GDOLLARS = 10;
export const PROOF_REWARD_DAILY_CAP = 5;
/** "Today" for the daily cap — most users are in Nigeria, so the cap resets at their midnight, not UTC's. */
const REWARD_TIMEZONE = "Africa/Lagos";

export type ProofRewardKind = "campaign" | "forfeit";

export type ProofRewardResult =
  | { status: "sent"; amount: number; paidToday: number; cap: number }
  | { status: "capped"; amount: number; cap: number }
  | { status: "not_verified"; amount: number }
  | { status: "self_verified"; amount: number }
  | { status: "awaiting_verifier"; amount: number }
  | { status: "not_eligible"; amount: number; reason: string }
  | { status: "failed"; amount: number };

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

/**
 * Records that a proof passed off-chain review (AI verdict), so a later
 * on-chain submission carrying this exact proof URL can be paid. Called from
 * the AI proof routes; never overwrites an existing row's status, so a
 * re-reviewed URL can't reset an already-paid reward.
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

function rewardDayFor(date: Date): string {
  // en-CA formats as YYYY-MM-DD, which is exactly Postgres's date literal.
  return new Intl.DateTimeFormat("en-CA", { timeZone: REWARD_TIMEZONE }).format(date);
}

async function proofTxDay(txHash: `0x${string}`): Promise<string> {
  // The proof's own block time, not "now" — a retried grant the next morning
  // still counts against the day the proof was actually submitted.
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  return rewardDayFor(new Date(Number(block.timestamp) * 1000));
}

type ResolvedProof = { wallet: string; proofUrl: string; rowId: string } | ProofRewardResult;

/**
 * Re-derives who submitted what from the on-chain tx (never trusts the
 * caller), then finds the approval row that proves this exact proof was
 * reviewed. Friend-verified forfeits have no AI review — they're gated on the
 * friend's on-chain approval instead, and get their row created here.
 */
async function resolveProof(
  admin: SupabaseAdmin,
  kind: ProofRewardKind,
  proofTxHash: `0x${string}`,
): Promise<ResolvedProof> {
  const amount = PROOF_REWARD_GDOLLARS;

  if (kind === "campaign") {
    const event = await parseCommunityMilestoneProofSubmittedFromTx(proofTxHash);
    if (!event) return { status: "not_eligible", amount, reason: "proof_not_found" };
    const { data: row } = await admin
      .from("proof_rewards")
      .select("id")
      .eq("wallet", event.participant)
      .eq("proof_url", event.proofLink)
      .eq("kind", "campaign")
      .maybeSingle();
    if (!row) return { status: "not_eligible", amount, reason: "not_reviewed" };
    return { wallet: event.participant, proofUrl: event.proofLink, rowId: row.id as string };
  }

  const event = await parseProofSubmittedFromTx(proofTxHash);
  if (!event) return { status: "not_eligible", amount, reason: "proof_not_found" };

  const { data: commitment } = await admin
    .from("forfeit_commitments")
    .select("id, verification_method")
    .eq("on_chain_commitment_id", Number(event.commitmentId))
    .maybeSingle();
  if (!commitment) return { status: "not_eligible", amount, reason: "commitment_not_found" };

  // Self-verified: the creator approves their own proof, so paying for it
  // would be free G$ for any photo. Deliberately never rewarded.
  if (commitment.verification_method === "self") return { status: "self_verified", amount };

  if (commitment.verification_method === "friend") {
    const { data: period } = await admin
      .from("forfeit_periods")
      .select("verifier_action")
      .eq("commitment_id", commitment.id)
      .eq("period_index", event.periodIndex)
      .maybeSingle();
    if (period?.verifier_action !== "approved") return { status: "awaiting_verifier", amount };
    await recordApprovedProof(admin, {
      wallet: event.creator,
      kind: "forfeit",
      proofUrl: event.proofLink,
      refId: commitment.id,
    });
  }

  const { data: row } = await admin
    .from("proof_rewards")
    .select("id")
    .eq("wallet", event.creator)
    .eq("proof_url", event.proofLink)
    .eq("kind", "forfeit")
    .maybeSingle();
  if (!row) return { status: "not_eligible", amount, reason: "not_reviewed" };
  return { wallet: event.creator, proofUrl: event.proofLink, rowId: row.id as string };
}

async function countPaidOnDay(admin: SupabaseAdmin, wallet: string, day: string): Promise<number> {
  const { count } = await admin
    .from("proof_rewards")
    .select("id", { count: "exact", head: true })
    .eq("wallet", wallet)
    .eq("reward_day", day)
    .eq("status", "sent");
  return count ?? 0;
}

/**
 * Pays PROOF_REWARD_GDOLLARS into RewardVault for one approved, on-chain
 * proof — at most PROOF_REWARD_DAILY_CAP paid proofs per wallet per Lagos
 * day, GoodDollar-verified wallets only. Safe to call repeatedly for the
 * same tx: the daily slot is reserved atomically in Postgres and the
 * on-chain rewardId is keyed by the proof tx, so nothing is ever paid twice.
 */
export async function grantProofReward(
  admin: SupabaseAdmin,
  params: { kind: ProofRewardKind; proofTxHash: `0x${string}` },
): Promise<ProofRewardResult> {
  const amount = PROOF_REWARD_GDOLLARS;
  const cap = PROOF_REWARD_DAILY_CAP;
  const proofTxHash = params.proofTxHash.toLowerCase() as `0x${string}`;

  const resolved = await resolveProof(admin, params.kind, proofTxHash);
  if ("status" in resolved) return resolved;
  const { wallet, rowId } = resolved;

  const verified = await isGoodDollarVerified(wallet);
  if (!verified) return { status: "not_verified", amount };

  const day = await proofTxDay(proofTxHash);

  const { data: slot, error: slotError } = await admin.rpc("reserve_proof_reward_slot", {
    p_id: rowId,
    p_wallet: wallet,
    p_day: day,
    p_tx_hash: proofTxHash,
    p_cap: cap,
  });
  if (slotError) {
    console.error("[proof-reward] slot reservation failed", slotError);
    return { status: "failed", amount };
  }
  if (slot === "capped") return { status: "capped", amount, cap };
  if (slot === "sent") {
    return { status: "sent", amount, paidToday: await countPaidOnDay(admin, wallet, day), cap };
  }
  if (slot !== "paying" && slot !== "failed") return { status: "failed", amount };

  try {
    const result = await payoutProofReward({
      wallet: wallet as `0x${string}`,
      proofTxHash,
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
      .eq("id", rowId);
    return { status: "sent", amount, paidToday: await countPaidOnDay(admin, wallet, day), cap };
  } catch (err) {
    console.error(`[proof-reward] deposit failed for ${proofTxHash}:`, err);
    // Never downgrade a row a concurrent call already marked paid.
    await admin
      .from("proof_rewards")
      .update({ status: "failed", reward_id: proofRewardRewardId(proofTxHash) })
      .eq("id", rowId)
      .neq("status", "sent");
    return { status: "failed", amount };
  }
}
