import type { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  checkPoolCredit,
  findPoolCreditTx,
  getPoolAvailableWhole,
  isRewardIdUsed,
  submitPoolCredit,
  waitForPoolCredit,
} from "@/lib/celo/reward-vault-payout";
import { loadRewardsConfig } from "@/lib/rewards/config";
import type { GoalKind, RewardCategory } from "@/lib/rewards/rules";

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type PayoutStatus = "pending" | "processing" | "submitted" | "confirmed" | "failed";

export type RewardPayoutRow = {
  id: string;
  wallet: string;
  category: RewardCategory;
  amount: number | string;
  dedupe_key: string;
  reward_id: string;
  goal_kind: GoalKind | null;
  goal_ref: string | null;
  period_key: string | null;
  reward_day: string;
  status: PayoutStatus;
  tx_hash: string | null;
  attempts: number;
  submitted_at: string | null;
  updated_at: string;
};

/** A 'processing' lease older than this is assumed to belong to a crashed worker. */
const LEASE_STALE_SECONDS = 300;
/** A submitted tx still unmined after this long is treated as dropped (resent after a usedRewardId check). */
const SUBMITTED_STALE_MS = 10 * 60_000;
/** Pending rows younger than this are probably still being handled by the request that created them. */
const PENDING_GRACE_MS = 2 * 60_000;

/**
 * Creates a reward row unless one with the same dedupe key exists, and
 * returns whichever row now holds that key. The unique index is what makes
 * concurrent or retried grants converge on a single reward.
 */
export async function reserveReward(
  admin: SupabaseAdmin,
  row: {
    wallet: string;
    category: RewardCategory;
    amount: number;
    dedupeKey: string;
    rewardId: string;
    goalKind?: GoalKind | null;
    goalRef?: string | null;
    periodKey: string;
    rewardDay: string;
    sourceProofId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string; status: PayoutStatus; created: boolean }> {
  const { data: inserted, error } = await admin
    .from("reward_payouts")
    .upsert(
      {
        wallet: row.wallet.toLowerCase(),
        category: row.category,
        amount: row.amount,
        dedupe_key: row.dedupeKey,
        reward_id: row.rewardId,
        goal_kind: row.goalKind ?? null,
        goal_ref: row.goalRef ?? null,
        period_key: row.periodKey,
        reward_day: row.rewardDay,
        source_proof_id: row.sourceProofId ?? null,
        metadata: row.metadata ?? {},
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id, status");
  if (error) throw new Error(`[rewards] reserve ${row.dedupeKey}: ${error.message}`);
  if (inserted && inserted.length > 0) {
    return { id: inserted[0].id as string, status: inserted[0].status as PayoutStatus, created: true };
  }

  const { data: existing, error: readError } = await admin
    .from("reward_payouts")
    .select("id, status")
    .eq("dedupe_key", row.dedupeKey)
    .single();
  if (readError || !existing) throw new Error(`[rewards] reserve ${row.dedupeKey}: row vanished`);
  return { id: existing.id as string, status: existing.status as PayoutStatus, created: false };
}

async function markConfirmed(admin: SupabaseAdmin, id: string, txHash: string | null) {
  const update: Record<string, unknown> = {
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
    locked_at: null,
    last_error: null,
  };
  if (txHash) update.tx_hash = txHash.toLowerCase();
  const { error } = await admin.from("reward_payouts").update(update).eq("id", id).neq("status", "confirmed");
  if (error) console.error(`[rewards] mark confirmed ${id} failed`, error);
}

async function markFailed(admin: SupabaseAdmin, id: string, fromStatus: PayoutStatus, reason: string) {
  const { error } = await admin
    .from("reward_payouts")
    .update({ status: "failed", locked_at: null, last_error: reason.slice(0, 500) })
    .eq("id", id)
    .eq("status", fromStatus);
  if (error) console.error(`[rewards] mark failed ${id} failed`, error);
}

/**
 * The vault already consumed this rewardId, so the reward was paid — find
 * the tx that did it (it may not be the one we last recorded) and confirm.
 */
async function confirmFromChain(admin: SupabaseAdmin, row: Pick<RewardPayoutRow, "id" | "reward_id" | "tx_hash">) {
  const txHash = (await findPoolCreditTx(row.reward_id as `0x${string}`)) ?? row.tx_hash;
  await markConfirmed(admin, row.id, txHash);
}

const BUDGET_NOTE = "Waiting: daily payout budget reached";

/** Start of the current UTC day — the same day boundary as RewardVault's on-chain daily cap. */
function utcDayStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Whether sending `amount` now stays inside the platform daily budget
 * (reward_config limits.dailyBudget; 0 = no limit). Rows held back stay
 * 'pending' and the cron sends them once a new day starts.
 */
async function withinDailyBudget(admin: SupabaseAdmin, amount: number): Promise<boolean> {
  const { limits } = await loadRewardsConfig(admin);
  if (!(limits.dailyBudget > 0)) return true;
  const { data, error } = await admin.rpc("reward_engine_sent_since", { p_since: utcDayStart() });
  if (error) throw new Error(`[rewards] budget check: ${error.message}`);
  return Number(data ?? 0) + amount <= limits.dailyBudget;
}

/**
 * Sends one reward through RewardVault.creditReward and records every step:
 * lease (processing) → tx broadcast, hash saved (submitted) → receipt
 * (confirmed / failed). If the receipt doesn't arrive within `waitMs`, the
 * row stays 'submitted' for reconcilePayouts — it's never marked paid on a
 * guess. Safe to call concurrently or repeatedly: only one caller gets the
 * lease, and the vault's usedRewardId blocks a second credit regardless.
 */
export async function processPayout(
  admin: SupabaseAdmin,
  payoutId: string,
  opts: { waitMs?: number } = {},
): Promise<PayoutStatus> {
  // Budget check before taking the lease, so held-back rows don't rack up attempts.
  const { data: before } = await admin
    .from("reward_payouts")
    .select("amount, status, last_error")
    .eq("id", payoutId)
    .maybeSingle();
  if (before && (before.status === "pending" || before.status === "failed")) {
    if (!(await withinDailyBudget(admin, Number(before.amount)))) {
      if (before.last_error !== BUDGET_NOTE) {
        await admin.from("reward_payouts").update({ last_error: BUDGET_NOTE }).eq("id", payoutId).eq("status", before.status);
      }
      // Not sent yet (the row keeps its status); callers treat it as queued.
      return "pending";
    }
  }

  const { data: leased, error } = await admin.rpc("claim_reward_payout", {
    p_id: payoutId,
    p_stale_seconds: LEASE_STALE_SECONDS,
  });
  if (error) throw new Error(`[rewards] lease ${payoutId}: ${error.message}`);
  const row = (leased as RewardPayoutRow[] | null)?.[0];
  if (!row) {
    const { data: current } = await admin.from("reward_payouts").select("status").eq("id", payoutId).maybeSingle();
    return (current?.status as PayoutStatus) ?? "failed";
  }

  let txHash: `0x${string}`;
  try {
    const submission = await submitPoolCredit({
      recipientWallet: row.wallet as `0x${string}`,
      amountWhole: Number(row.amount),
      rewardId: row.reward_id as `0x${string}`,
      context: `${row.category} ${row.dedupe_key}`,
    });
    if (submission.kind === "already_used") {
      await confirmFromChain(admin, row);
      return "confirmed";
    }
    txHash = submission.txHash;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[rewards] submit ${row.dedupe_key} failed:`, reason);
    await markFailed(admin, row.id, "processing", reason);
    return "failed";
  }

  // Persist the hash before waiting, so a timeout or crash leaves a tx the
  // reconciler can look up rather than an unknown one.
  const { error: submitError } = await admin
    .from("reward_payouts")
    .update({
      status: "submitted",
      tx_hash: txHash.toLowerCase(),
      submitted_at: new Date().toISOString(),
      locked_at: null,
    })
    .eq("id", row.id)
    .eq("status", "processing");
  if (submitError) console.error(`[rewards] record submitted ${row.id} failed`, submitError);

  const state = await waitForPoolCredit(txHash, opts.waitMs ?? 30_000);
  if (state === "confirmed") {
    await markConfirmed(admin, row.id, txHash);
    return "confirmed";
  }
  if (state === "reverted") {
    // Reverted can still mean "already paid" if another tx won the race.
    if (await isRewardIdUsed(row.reward_id as `0x${string}`)) {
      await confirmFromChain(admin, row);
      return "confirmed";
    }
    await markFailed(admin, row.id, "submitted", `creditReward reverted (tx ${txHash})`);
    return "failed";
  }
  return "submitted";
}

export type ReconcileResult = {
  submittedChecked: number;
  confirmed: number;
  failed: number;
  retried: number;
  stillOpen: number;
  poolAvailable: number | null;
  poolShort: boolean;
  budgetReached: boolean;
};

/**
 * Cron-side bookkeeping for the ledger:
 *  1. Settles 'submitted' rows from their receipts (or, for a tx that
 *     vanished, from usedRewardId) — so nothing stays "in flight" forever.
 *  2. Resends 'failed', stale 'pending' and stale 'processing' rows, only
 *     as many as the vault pool can cover, oldest-touched first so one
 *     stuck row can't starve the rest.
 */
export async function reconcilePayouts(
  admin: SupabaseAdmin,
  opts: { limit?: number; deadlineMs?: number } = {},
): Promise<ReconcileResult> {
  const limit = opts.limit ?? 25;
  const deadline = Date.now() + (opts.deadlineMs ?? 80_000);
  const result: ReconcileResult = {
    submittedChecked: 0,
    confirmed: 0,
    failed: 0,
    retried: 0,
    stillOpen: 0,
    poolAvailable: null,
    poolShort: false,
    budgetReached: false,
  };

  const { data: submitted, error: submittedError } = await admin
    .from("reward_payouts")
    .select("id, reward_id, tx_hash, submitted_at, updated_at")
    .eq("status", "submitted")
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (submittedError) throw new Error(`[rewards] submitted lookup: ${submittedError.message}`);

  for (const row of (submitted ?? []) as RewardPayoutRow[]) {
    if (Date.now() > deadline) break;
    result.submittedChecked++;
    const state = row.tx_hash ? await checkPoolCredit(row.tx_hash as `0x${string}`) : "pending";
    if (state === "confirmed") {
      await markConfirmed(admin, row.id, row.tx_hash);
      result.confirmed++;
      continue;
    }
    const age = Date.now() - new Date(row.submitted_at ?? row.updated_at).getTime();
    if (state === "pending" && age < SUBMITTED_STALE_MS) {
      result.stillOpen++;
      continue;
    }
    if (await isRewardIdUsed(row.reward_id as `0x${string}`)) {
      await confirmFromChain(admin, row);
      result.confirmed++;
    } else {
      await markFailed(
        admin,
        row.id,
        "submitted",
        state === "reverted" ? `creditReward reverted (tx ${row.tx_hash})` : `tx ${row.tx_hash} not mined; resending`,
      );
      result.failed++;
    }
  }

  const pendingCutoff = new Date(Date.now() - PENDING_GRACE_MS).toISOString();
  const leaseCutoff = new Date(Date.now() - LEASE_STALE_SECONDS * 1000).toISOString();
  const { data: retryable, error: retryError } = await admin
    .from("reward_payouts")
    .select("id, amount, status, updated_at")
    .or(
      `status.eq.failed,and(status.eq.pending,updated_at.lt.${pendingCutoff}),and(status.eq.processing,updated_at.lt.${leaseCutoff})`,
    )
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (retryError) throw new Error(`[rewards] retry lookup: ${retryError.message}`);
  if (!retryable || retryable.length === 0) return result;

  // One RPC read decides how much of the backlog the pool can cover now, so
  // an empty vault doesn't cost a failed tx per row.
  let budget = await getPoolAvailableWhole();
  result.poolAvailable = budget;
  for (const row of retryable) {
    if (Date.now() > deadline || result.budgetReached) {
      result.stillOpen++;
      continue;
    }
    const amount = Number(row.amount);
    if (amount > budget) {
      result.poolShort = true;
      result.stillOpen++;
      continue;
    }
    const status = await processPayout(admin, row.id as string, { waitMs: 15_000 });
    if (status === "confirmed") {
      result.retried++;
      budget -= amount;
    } else if (status === "submitted") {
      result.stillOpen++;
      budget -= amount;
    } else if (status === "pending") {
      // Held by the platform daily budget — everything after it would be too.
      result.stillOpen++;
      result.budgetReached = true;
    } else {
      result.failed++;
    }
  }
  return result;
}
